package database

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"live-polling-backend/internal/config"
	"live-polling-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoDB struct {
	Client      *mongo.Client
	Database    *mongo.Database
	Users       *mongo.Collection
	Polls       *mongo.Collection
	Votes       *mongo.Collection
	IsConnected bool

	// Resilient in-memory fallback store for local testing when Mongo daemon isn't running
	mu          sync.RWMutex
	memUsers    map[string]*models.User // keyed by ID or email
	memPolls    map[string]*models.Poll // keyed by ID
	memVotes    map[string]*models.Vote // keyed by ID
}

func ConnectMongo(cfg *config.Config) *MongoDB {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	store := &MongoDB{
		IsConnected: false,
		memUsers:    make(map[string]*models.User),
		memPolls:    make(map[string]*models.Poll),
		memVotes:    make(map[string]*models.Vote),
	}

	clientOptions := options.Client().ApplyURI(cfg.MongoURI)
	client, err := mongo.Connect(ctx, clientOptions)
	if err == nil {
		if pingErr := client.Ping(ctx, nil); pingErr == nil {
			db := client.Database(cfg.MongoDBName)
			store.Client = client
			store.Database = db
			store.Users = db.Collection("users")
			store.Polls = db.Collection("polls")
			store.Votes = db.Collection("votes")
			store.IsConnected = true

			initIndexes(store)
			log.Printf("✅ Connected to MongoDB successfully (Database: %s)", cfg.MongoDBName)
			return store
		}
	}

	log.Printf("⚠️ Warning: Could not connect to MongoDB at %s.", cfg.MongoURI)
	log.Println("👉 Active in-memory fallback store enabled for local testing. Connect real MongoDB via MONGO_URI in .env or Docker.")
	return store
}

func initIndexes(m *MongoDB) {
	if !m.IsConnected {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, _ = m.Users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	_, _ = m.Polls.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "creator_id", Value: 1}},
	})

	_, _ = m.Votes.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "poll_id", Value: 1},
			{Key: "voter_fingerprint", Value: 1},
		},
		Options: options.Index().SetUnique(true),
	})
}

// User Operations
func (m *MongoDB) CreateUser(ctx context.Context, user *models.User) error {
	if m.IsConnected {
		res, err := m.Users.InsertOne(ctx, user)
		if err != nil {
			return err
		}
		if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
			user.ID = oid
		}
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	for _, u := range m.memUsers {
		if u.Email == user.Email {
			return errors.New("email already exists")
		}
	}
	user.ID = primitive.NewObjectID()
	m.memUsers[user.ID.Hex()] = user
	return nil
}

func (m *MongoDB) FindUserByEmail(ctx context.Context, email string) (*models.User, error) {
	if m.IsConnected {
		var user models.User
		err := m.Users.FindOne(ctx, bson.M{"email": email}).Decode(&user)
		if err != nil {
			return nil, err
		}
		return &user, nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, u := range m.memUsers {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, mongo.ErrNoDocuments
}

func (m *MongoDB) FindUserByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	if m.IsConnected {
		var user models.User
		err := m.Users.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
		if err != nil {
			return nil, err
		}
		return &user, nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	if u, ok := m.memUsers[id.Hex()]; ok {
		return u, nil
	}
	return nil, mongo.ErrNoDocuments
}

// Poll Operations
func (m *MongoDB) CreatePoll(ctx context.Context, poll *models.Poll) error {
	if m.IsConnected {
		res, err := m.Polls.InsertOne(ctx, poll)
		if err != nil {
			return err
		}
		if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
			poll.ID = oid
		}
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	poll.ID = primitive.NewObjectID()
	m.memPolls[poll.ID.Hex()] = poll
	return nil
}

func (m *MongoDB) FindPollByID(ctx context.Context, id primitive.ObjectID) (*models.Poll, error) {
	if m.IsConnected {
		var poll models.Poll
		err := m.Polls.FindOne(ctx, bson.M{"_id": id}).Decode(&poll)
		if err != nil {
			return nil, err
		}
		return &poll, nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	if p, ok := m.memPolls[id.Hex()]; ok {
		return p, nil
	}
	return nil, mongo.ErrNoDocuments
}

func (m *MongoDB) FindPollsByCreator(ctx context.Context, creatorID primitive.ObjectID) ([]*models.Poll, error) {
	if m.IsConnected {
		opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
		cursor, err := m.Polls.Find(ctx, bson.M{"creator_id": creatorID}, opts)
		if err != nil {
			return nil, err
		}
		defer cursor.Close(ctx)

		var polls []*models.Poll
		if err := cursor.All(ctx, &polls); err != nil {
			return nil, err
		}
		return polls, nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	var polls []*models.Poll
	for _, p := range m.memPolls {
		if p.CreatorID == creatorID {
			polls = append(polls, p)
		}
	}
	return polls, nil
}

func (m *MongoDB) UpdatePollStatus(ctx context.Context, id primitive.ObjectID, creatorID primitive.ObjectID, isActive bool) error {
	if m.IsConnected {
		filter := bson.M{"_id": id, "creator_id": creatorID}
		update := bson.M{
			"$set": bson.M{
				"is_active":  isActive,
				"updated_at": time.Now(),
			},
		}
		res, err := m.Polls.UpdateOne(ctx, filter, update)
		if err != nil {
			return err
		}
		if res.MatchedCount == 0 {
			return errors.New("poll not found or unauthorized")
		}
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.memPolls[id.Hex()]
	if !ok || p.CreatorID != creatorID {
		return errors.New("poll not found or unauthorized")
	}
	p.IsActive = isActive
	p.UpdatedAt = time.Now()
	return nil
}

func (m *MongoDB) DeletePoll(ctx context.Context, id primitive.ObjectID, creatorID primitive.ObjectID) error {
	if m.IsConnected {
		filter := bson.M{"_id": id, "creator_id": creatorID}
		res, err := m.Polls.DeleteOne(ctx, filter)
		if err != nil {
			return err
		}
		if res.DeletedCount == 0 {
			return errors.New("poll not found or unauthorized")
		}
		_, _ = m.Votes.DeleteMany(ctx, bson.M{"poll_id": id})
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.memPolls[id.Hex()]
	if !ok || p.CreatorID != creatorID {
		return errors.New("poll not found or unauthorized")
	}
	delete(m.memPolls, id.Hex())
	return nil
}

func (m *MongoDB) UpdatePollOptionCounts(ctx context.Context, id primitive.ObjectID, counts map[string]int64, total int64) error {
	if m.IsConnected {
		poll, err := m.FindPollByID(ctx, id)
		if err != nil {
			return err
		}
		for i := range poll.Options {
			if c, ok := counts[poll.Options[i].ID]; ok {
				poll.Options[i].VoteCount = c
			}
		}
		poll.TotalVotes = total
		poll.UpdatedAt = time.Now()

		_, err = m.Polls.ReplaceOne(ctx, bson.M{"_id": id}, poll)
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if p, ok := m.memPolls[id.Hex()]; ok {
		for i := range p.Options {
			if c, ok := counts[p.Options[i].ID]; ok {
				p.Options[i].VoteCount = c
			}
		}
		p.TotalVotes = total
		p.UpdatedAt = time.Now()
	}
	return nil
}

// Vote Operations
func (m *MongoDB) RecordVote(ctx context.Context, vote *models.Vote) error {
	if m.IsConnected {
		_, err := m.Votes.InsertOne(ctx, vote)
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	vote.ID = primitive.NewObjectID()
	m.memVotes[vote.ID.Hex()] = vote
	return nil
}
