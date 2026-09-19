package database

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"live-polling-backend/internal/config"
	"live-polling-backend/internal/models"

	"github.com/redis/go-redis/v9"
)

type RedisService struct {
	Client      *redis.Client
	IsAvailable bool

	// In-memory fallback for local environments where Redis server isn't running
	mu           sync.RWMutex
	fallbackMap  map[string]map[string]int64
	fallbackSets map[string]map[string]bool
	fallbackSubs map[string][]chan string
}

func ConnectRedis(cfg *config.Config) *RedisService {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opt, err := redis.ParseURL(cfg.RedisURI)
	if err != nil {
		// Try fallback host:port parsing
		opt = &redis.Options{
			Addr: "localhost:6379",
		}
	}

	client := redis.NewClient(opt)

	service := &RedisService{
		Client:       client,
		IsAvailable:  false,
		fallbackMap:  make(map[string]map[string]int64),
		fallbackSets: make(map[string]map[string]bool),
		fallbackSubs: make(map[string][]chan string),
	}

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️ Warning: Could not connect to Redis at %s: %v", cfg.RedisURI, err)
		log.Println("👉 Tip: For production or Docker, Redis will handle live counts & Pub/Sub. Operating in resilient fallback mode for local testing.")
		return service
	}

	service.IsAvailable = true
	log.Printf("✅ Connected to Redis successfully at %s", opt.Addr)
	return service
}

// RecordVoteAtomic increments option count and checks for duplicate voter in an atomic operation.
// Returns (alreadyVoted bool, newVoteCounts map[string]int64, totalVotes int64, err error)
func (r *RedisService) RecordVoteAtomic(ctx context.Context, pollID string, optionIDs []string, voterFingerprint string) (bool, map[string]int64, int64, error) {
	if !r.IsAvailable {
		r.mu.Lock()
		defer r.mu.Unlock()

		// Check duplicate voter
		setKey := "poll:" + pollID + ":voters"
		if r.fallbackSets[setKey] == nil {
			r.fallbackSets[setKey] = make(map[string]bool)
		}
		if r.fallbackSets[setKey][voterFingerprint] {
			return true, nil, 0, nil
		}
		r.fallbackSets[setKey][voterFingerprint] = true

		// Increment counts
		mapKey := "poll:" + pollID + ":votes"
		if r.fallbackMap[mapKey] == nil {
			r.fallbackMap[mapKey] = make(map[string]int64)
		}

		var total int64
		for _, optID := range optionIDs {
			r.fallbackMap[mapKey][optID]++
		}
		for _, count := range r.fallbackMap[mapKey] {
			total += count
		}

		// Copy result map
		result := make(map[string]int64)
		for k, v := range r.fallbackMap[mapKey] {
			result[k] = v
		}
		return false, result, total, nil
	}

	votersKey := fmt.Sprintf("poll:%s:voters", pollID)
	votesKey := fmt.Sprintf("poll:%s:votes", pollID)
	totalKey := fmt.Sprintf("poll:%s:total", pollID)

	// Redis SADD returns 1 if element was newly added, 0 if already present (duplicate)
	added, err := r.Client.SAdd(ctx, votersKey, voterFingerprint).Result()
	if err != nil {
		return false, nil, 0, fmt.Errorf("redis SAdd failed: %w", err)
	}
	if added == 0 {
		// Voter has already voted on this poll!
		return true, nil, 0, nil
	}

	// Atomically increment the selected options and total count using Redis Pipeline
	pipe := r.Client.Pipeline()
	for _, optID := range optionIDs {
		pipe.HIncrBy(ctx, votesKey, optID, 1)
	}
	pipe.IncrBy(ctx, totalKey, int64(len(optionIDs)))
	hGetAllCmd := pipe.HGetAll(ctx, votesKey)
	getTotalCmd := pipe.Get(ctx, totalKey)

	_, err = pipe.Exec(ctx)
	if err != nil {
		return false, nil, 0, fmt.Errorf("redis pipeline failed: %w", err)
	}

	rawCounts, _ := hGetAllCmd.Result()
	voteCounts := make(map[string]int64)
	for optID, countStr := range rawCounts {
		c, _ := strconv.ParseInt(countStr, 10, 64)
		voteCounts[optID] = c
	}

	totalVotes, _ := strconv.ParseInt(getTotalCmd.Val(), 10, 64)
	return false, voteCounts, totalVotes, nil
}

// HasVoted checks if the given voter fingerprint has already voted on this poll
func (r *RedisService) HasVoted(ctx context.Context, pollID, voterFingerprint string) (bool, error) {
	if !r.IsAvailable {
		r.mu.RLock()
		defer r.mu.RUnlock()
		setKey := "poll:" + pollID + ":voters"
		if voters, exists := r.fallbackSets[setKey]; exists {
			return voters[voterFingerprint], nil
		}
		return false, nil
	}

	votersKey := fmt.Sprintf("poll:%s:voters", pollID)
	return r.Client.SIsMember(ctx, votersKey, voterFingerprint).Result()
}

// GetLiveVoteCounts retrieves current counts directly from Redis hash
func (r *RedisService) GetLiveVoteCounts(ctx context.Context, pollID string) (map[string]int64, int64, error) {
	if !r.IsAvailable {
		r.mu.RLock()
		defer r.mu.RUnlock()
		mapKey := "poll:" + pollID + ":votes"
		result := make(map[string]int64)
		var total int64
		if m, exists := r.fallbackMap[mapKey]; exists {
			for k, v := range m {
				result[k] = v
				total += v
			}
		}
		return result, total, nil
	}

	votesKey := fmt.Sprintf("poll:%s:votes", pollID)
	totalKey := fmt.Sprintf("poll:%s:total", pollID)

	rawCounts, err := r.Client.HGetAll(ctx, votesKey).Result()
	if err != nil && err != redis.Nil {
		return nil, 0, err
	}

	counts := make(map[string]int64)
	for optID, countStr := range rawCounts {
		c, _ := strconv.ParseInt(countStr, 10, 64)
		counts[optID] = c
	}

	totalStr, _ := r.Client.Get(ctx, totalKey).Result()
	total, _ := strconv.ParseInt(totalStr, 10, 64)
	return counts, total, nil
}

// SyncPollInitialCounts loads initial option counts into Redis
func (r *RedisService) SyncPollInitialCounts(ctx context.Context, poll *models.Poll) error {
	if !r.IsAvailable {
		r.mu.Lock()
		defer r.mu.Unlock()
		mapKey := "poll:" + poll.ID.Hex() + ":votes"
		if r.fallbackMap[mapKey] == nil {
			r.fallbackMap[mapKey] = make(map[string]int64)
			for _, opt := range poll.Options {
				r.fallbackMap[mapKey][opt.ID] = opt.VoteCount
			}
		}
		return nil
	}

	votesKey := fmt.Sprintf("poll:%s:votes", poll.ID.Hex())
	totalKey := fmt.Sprintf("poll:%s:total", poll.ID.Hex())

	pipe := r.Client.Pipeline()
	for _, opt := range poll.Options {
		pipe.HSetNX(ctx, votesKey, opt.ID, opt.VoteCount)
	}
	pipe.SetNX(ctx, totalKey, poll.TotalVotes, 0)
	_, err := pipe.Exec(ctx)
	return err
}

// PublishPollUpdate broadcasts updated poll payload to Redis Pub/Sub channel
func (r *RedisService) PublishPollUpdate(ctx context.Context, pollID string, payload *models.PollResultsPayload) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	channel := fmt.Sprintf("poll_updates:%s", pollID)

	if !r.IsAvailable {
		r.mu.Lock()
		defer r.mu.Unlock()
		if subs, ok := r.fallbackSubs[channel]; ok {
			for _, ch := range subs {
				select {
				case ch <- string(data):
				default:
				}
			}
		}
		return nil
	}

	return r.Client.Publish(ctx, channel, string(data)).Err()
}

// SubscribeToPollUpdates subscribes to Redis Pub/Sub channel for a given poll
func (r *RedisService) SubscribeToPollUpdates(ctx context.Context, pollID string) (<-chan string, func(), error) {
	channel := fmt.Sprintf("poll_updates:%s", pollID)
	out := make(chan string, 100)

	if !r.IsAvailable {
		r.mu.Lock()
		r.fallbackSubs[channel] = append(r.fallbackSubs[channel], out)
		r.mu.Unlock()

		cleanup := func() {
			r.mu.Lock()
			defer r.mu.Unlock()
			subs := r.fallbackSubs[channel]
			for i, ch := range subs {
				if ch == out {
					r.fallbackSubs[channel] = append(subs[:i], subs[i+1:]...)
					break
				}
			}
			close(out)
		}
		return out, cleanup, nil
	}

	pubsub := r.Client.Subscribe(ctx, channel)
	ch := pubsub.Channel()

	go func() {
		for msg := range ch {
			select {
			case out <- msg.Payload:
			case <-ctx.Done():
				return
			}
		}
	}()

	cleanup := func() {
		_ = pubsub.Close()
		close(out)
	}

	return out, cleanup, nil
}
