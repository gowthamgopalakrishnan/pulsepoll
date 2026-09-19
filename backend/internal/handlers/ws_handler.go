package handlers

import (
	"log"
	"time"

	"live-polling-backend/internal/database"
	"live-polling-backend/internal/models"
	"live-polling-backend/internal/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WSHandler struct {
	Mongo    *database.MongoDB
	Redis    *database.RedisService
	Realtime *services.RealtimeHub
}

func NewWSHandler(mongo *database.MongoDB, redis *database.RedisService, realtime *services.RealtimeHub) *WSHandler {
	return &WSHandler{
		Mongo:    mongo,
		Redis:    redis,
		Realtime: realtime,
	}
}

// StreamPoll godoc
// GET /ws/polls/:id
func (h *WSHandler) StreamPoll(c *gin.Context) {
	pollIDStr := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		log.Printf("Invalid poll ID in WebSocket request: %s", pollIDStr)
		return
	}

	var initialPayload *models.PollResultsPayload

	poll, err := h.Mongo.FindPollByID(c.Request.Context(), oid)
	if err == nil && poll != nil {
		counts, total, redisErr := h.Redis.GetLiveVoteCounts(c.Request.Context(), pollIDStr)
		opts := make([]models.PollOption, len(poll.Options))
		for i, opt := range poll.Options {
			cnt := opt.VoteCount
			if redisErr == nil {
				if c, exists := counts[opt.ID]; exists {
					cnt = c
				}
			}
			opts[i] = models.PollOption{
				ID:        opt.ID,
				Text:      opt.Text,
				VoteCount: cnt,
			}
		}

		tot := poll.TotalVotes
		if redisErr == nil && total > 0 {
			tot = total
		}

		initialPayload = &models.PollResultsPayload{
			PollID:      pollIDStr,
			TotalVotes:  tot,
			Options:     opts,
			IsActive:    poll.IsActive,
			LastUpdated: time.Now(),
		}
	}

	h.Realtime.HandleWebSocket(c.Writer, c.Request, pollIDStr, initialPayload)
}
