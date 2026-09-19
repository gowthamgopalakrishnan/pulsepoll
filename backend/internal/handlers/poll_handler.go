package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"live-polling-backend/internal/database"
	"live-polling-backend/internal/models"
	"live-polling-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PollHandler struct {
	Mongo    *database.MongoDB
	Redis    *database.RedisService
	Realtime *services.RealtimeHub
}

func NewPollHandler(mongo *database.MongoDB, redis *database.RedisService, realtime *services.RealtimeHub) *PollHandler {
	return &PollHandler{
		Mongo:    mongo,
		Redis:    redis,
		Realtime: realtime,
	}
}

// CreatePoll godoc
// POST /api/polls (Auth required)
func (h *PollHandler) CreatePoll(c *gin.Context) {
	var req models.CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	userIDStr, _ := c.Get("userID")
	userName, _ := c.Get("userName")
	creatorOID, err := primitive.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Clean and validate options
	uniqueOptions := make(map[string]bool)
	var pollOptions []models.PollOption

	for i, optText := range req.Options {
		trimmed := strings.TrimSpace(optText)
		if trimmed == "" {
			continue
		}
		lower := strings.ToLower(trimmed)
		if uniqueOptions[lower] {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Duplicate option found: '%s'", trimmed)})
			return
		}
		uniqueOptions[lower] = true

		pollOptions = append(pollOptions, models.PollOption{
			ID:        fmt.Sprintf("opt_%d_%s", i+1, uuid.New().String()[:8]),
			Text:      trimmed,
			VoteCount: 0,
		})
	}

	if len(pollOptions) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least two distinct options are required"})
		return
	}

	now := time.Now()
	var expiresAt *time.Time
	if req.DurationMinutes > 0 {
		exp := now.Add(time.Duration(req.DurationMinutes) * time.Minute)
		expiresAt = &exp
	}

	poll := &models.Poll{
		Title:         strings.TrimSpace(req.Title),
		Description:   strings.TrimSpace(req.Description),
		CreatorID:     creatorOID,
		CreatorName:   userName.(string),
		Options:       pollOptions,
		AllowMultiple: req.AllowMultiple,
		IsActive:      true,
		TotalVotes:    0,
		ExpiresAt:     expiresAt,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := h.Mongo.CreatePoll(c.Request.Context(), poll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create poll", "details": err.Error()})
		return
	}

	// Initialize option counts in Redis
	_ = h.Redis.SyncPollInitialCounts(c.Request.Context(), poll)

	c.JSON(http.StatusCreated, poll)
}

// GetUserPolls godoc
// GET /api/polls (Auth required)
func (h *PollHandler) GetUserPolls(c *gin.Context) {
	userIDStr, _ := c.Get("userID")
	creatorOID, err := primitive.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	polls, err := h.Mongo.FindPollsByCreator(c.Request.Context(), creatorOID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve polls", "details": err.Error()})
		return
	}

	if polls == nil {
		polls = make([]*models.Poll, 0)
	}

	// Hydrate live vote counts from Redis for each poll
	for _, p := range polls {
		counts, total, err := h.Redis.GetLiveVoteCounts(c.Request.Context(), p.ID.Hex())
		if err == nil && len(counts) > 0 {
			for i := range p.Options {
				if c, ok := counts[p.Options[i].ID]; ok {
					p.Options[i].VoteCount = c
				}
			}
			p.TotalVotes = total
		}
	}

	c.JSON(http.StatusOK, polls)
}

// GetPoll godoc
// GET /api/polls/:id (Public)
func (h *PollHandler) GetPoll(c *gin.Context) {
	pollIDStr := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID format"})
		return
	}

	poll, err := h.Mongo.FindPollByID(c.Request.Context(), oid)
	if err != nil || poll == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
		return
	}

	// Check if expired
	if poll.IsActive && poll.ExpiresAt != nil && time.Now().After(*poll.ExpiresAt) {
		poll.IsActive = false
		_ = h.Mongo.UpdatePollStatus(c.Request.Context(), poll.ID, poll.CreatorID, false)
	}

	// Merge real-time counts from Redis
	counts, total, err := h.Redis.GetLiveVoteCounts(c.Request.Context(), poll.ID.Hex())
	if err == nil && len(counts) > 0 {
		for i := range poll.Options {
			if c, ok := counts[poll.Options[i].ID]; ok {
				poll.Options[i].VoteCount = c
			}
		}
		poll.TotalVotes = total
	}

	c.JSON(http.StatusOK, poll)
}

// UpdatePollStatus godoc
// PATCH /api/polls/:id/status (Auth required)
func (h *PollHandler) UpdatePollStatus(c *gin.Context) {
	pollIDStr := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID format"})
		return
	}

	var req models.UpdatePollStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status value", "details": err.Error()})
		return
	}

	userIDStr, _ := c.Get("userID")
	creatorOID, _ := primitive.ObjectIDFromHex(userIDStr.(string))

	if err := h.Mongo.UpdatePollStatus(c.Request.Context(), oid, creatorOID, *req.IsActive); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Failed to update poll status", "details": err.Error()})
		return
	}

	// Fetch updated poll
	poll, _ := h.Mongo.FindPollByID(c.Request.Context(), oid)
	if poll != nil {
		counts, total, _ := h.Redis.GetLiveVoteCounts(c.Request.Context(), pollIDStr)
		if len(counts) > 0 {
			for i := range poll.Options {
				if c, ok := counts[poll.Options[i].ID]; ok {
					poll.Options[i].VoteCount = c
				}
			}
			poll.TotalVotes = total
		}

		// Broadcast status change via Redis Pub/Sub so all connected live audience members see the state change
		payload := &models.PollResultsPayload{
			PollID:      pollIDStr,
			TotalVotes:  poll.TotalVotes,
			Options:     poll.Options,
			IsActive:    *req.IsActive,
			LastUpdated: time.Now(),
		}
		_ = h.Redis.PublishPollUpdate(c.Request.Context(), pollIDStr, payload)
		h.Realtime.BroadcastLocal(pollIDStr, payload)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll status updated", "is_active": *req.IsActive})
}

// DeletePoll godoc
// DELETE /api/polls/:id (Auth required)
func (h *PollHandler) DeletePoll(c *gin.Context) {
	pollIDStr := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID format"})
		return
	}

	userIDStr, _ := c.Get("userID")
	creatorOID, _ := primitive.ObjectIDFromHex(userIDStr.(string))

	if err := h.Mongo.DeletePoll(c.Request.Context(), oid, creatorOID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Failed to delete poll", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll deleted successfully"})
}
