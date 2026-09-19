package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"live-polling-backend/internal/database"
	"live-polling-backend/internal/models"
	"live-polling-backend/internal/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type VoteHandler struct {
	Mongo    *database.MongoDB
	Redis    *database.RedisService
	Realtime *services.RealtimeHub
}

func NewVoteHandler(mongo *database.MongoDB, redis *database.RedisService, realtime *services.RealtimeHub) *VoteHandler {
	return &VoteHandler{
		Mongo:    mongo,
		Redis:    redis,
		Realtime: realtime,
	}
}

// CastVote godoc
// POST /api/polls/:id/vote (Public for audience)
func (h *VoteHandler) CastVote(c *gin.Context) {
	pollIDStr := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID format"})
		return
	}

	var req models.CastVoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vote request", "details": err.Error()})
		return
	}

	// Fetch poll from MongoDB
	poll, err := h.Mongo.FindPollByID(c.Request.Context(), oid)
	if err != nil || poll == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
		return
	}

	// Check if poll is active
	if !poll.IsActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This poll is closed and no longer accepting votes"})
		return
	}

	// Check if poll has expired
	if poll.ExpiresAt != nil && time.Now().After(*poll.ExpiresAt) {
		poll.IsActive = false
		_ = h.Mongo.UpdatePollStatus(c.Request.Context(), poll.ID, poll.CreatorID, false)
		c.JSON(http.StatusBadRequest, gin.H{"error": "This poll has ended"})
		return
	}

	// Validate multiple selection setting
	if !poll.AllowMultiple && len(req.OptionIDs) > 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This poll only allows a single selection"})
		return
	}

	// Verify all option IDs exist in this poll
	validOptionIDs := make(map[string]bool)
	for _, opt := range poll.Options {
		validOptionIDs[opt.ID] = true
	}
	for _, optID := range req.OptionIDs {
		if !validOptionIDs[optID] {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid option selected: %s", optID)})
			return
		}
	}

	// ATOMIC REDIS VOTE EXECUTION:
	// 1. O(1) duplicate voter check using Redis Set (SADD)
	// 2. Sub-millisecond atomic increment using Redis Hash (HINCRBY)
	alreadyVoted, newCounts, totalVotes, err := h.Redis.RecordVoteAtomic(
		c.Request.Context(),
		pollIDStr,
		req.OptionIDs,
		req.VoterFingerprint,
	)

	if err != nil {
		log.Printf("Error recording vote in Redis: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record vote", "details": err.Error()})
		return
	}

	if alreadyVoted {
		c.JSON(http.StatusConflict, gin.H{
			"error":     "You have already voted in this poll from this device",
			"has_voted": true,
		})
		return
	}

	// Persist vote record to MongoDB asynchronously for audit history & durability
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		clientIP := c.ClientIP()
		voteRecord := &models.Vote{
			PollID:           oid,
			OptionIDs:        req.OptionIDs,
			VoterFingerprint: req.VoterFingerprint,
			IPAddress:        clientIP,
			CreatedAt:        time.Now(),
		}
		_ = h.Mongo.RecordVote(bgCtx, voteRecord)
		_ = h.Mongo.UpdatePollOptionCounts(bgCtx, oid, newCounts, totalVotes)
	}()

	// Build updated poll options payload
	updatedOptions := make([]models.PollOption, len(poll.Options))
	for i, opt := range poll.Options {
		cnt := opt.VoteCount
		if c, exists := newCounts[opt.ID]; exists {
			cnt = c
		}
		updatedOptions[i] = models.PollOption{
			ID:        opt.ID,
			Text:      opt.Text,
			VoteCount: cnt,
		}
	}

	payload := &models.PollResultsPayload{
		PollID:      pollIDStr,
		TotalVotes:  totalVotes,
		Options:     updatedOptions,
		IsActive:    poll.IsActive,
		LastUpdated: time.Now(),
	}

	// Broadcast updated counts to all active WebSocket clients via Redis Pub/Sub
	_ = h.Redis.PublishPollUpdate(c.Request.Context(), pollIDStr, payload)
	h.Realtime.BroadcastLocal(pollIDStr, payload)

	c.JSON(http.StatusOK, gin.H{
		"message":     "Vote recorded successfully",
		"poll_id":     pollIDStr,
		"total_votes": totalVotes,
		"options":     updatedOptions,
	})
}

// CheckVoteStatus godoc
// GET /api/polls/:id/has-voted?fingerprint=xyz (Public)
func (h *VoteHandler) CheckVoteStatus(c *gin.Context) {
	pollIDStr := c.Param("id")
	fingerprint := c.Query("fingerprint")

	if fingerprint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fingerprint query parameter is required"})
		return
	}

	hasVoted, err := h.Redis.HasVoted(c.Request.Context(), pollIDStr, fingerprint)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"has_voted": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"has_voted": hasVoted,
	})
}
