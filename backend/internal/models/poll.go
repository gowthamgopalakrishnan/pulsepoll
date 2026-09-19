package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PollOption struct {
	ID        string `bson:"id" json:"id"`
	Text      string `bson:"text" json:"text"`
	VoteCount int64  `bson:"vote_count" json:"vote_count"`
}

type Poll struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title         string             `bson:"title" json:"title"`
	Description   string             `bson:"description" json:"description"`
	CreatorID     primitive.ObjectID `bson:"creator_id" json:"creator_id"`
	CreatorName   string             `bson:"creator_name" json:"creator_name"`
	Options       []PollOption       `bson:"options" json:"options"`
	AllowMultiple bool               `bson:"allow_multiple" json:"allow_multiple"`
	IsActive      bool               `bson:"is_active" json:"is_active"`
	TotalVotes    int64              `bson:"total_votes" json:"total_votes"`
	ExpiresAt     *time.Time         `bson:"expires_at,omitempty" json:"expires_at,omitempty"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time          `bson:"updated_at" json:"updated_at"`
}

type CreatePollRequest struct {
	Title           string   `json:"title" binding:"required,min=3,max=300"`
	Description     string   `json:"description" binding:"max=1000"`
	Options         []string `json:"options" binding:"required,min=2,max=10,dive,min=1,max=150"`
	AllowMultiple   bool     `json:"allow_multiple"`
	DurationMinutes int      `json:"duration_minutes" binding:"omitempty,min=0,max=10080"` // up to 7 days
}

type UpdatePollStatusRequest struct {
	IsActive *bool `json:"is_active" binding:"required"`
}

type PollResultsPayload struct {
	PollID      string       `json:"poll_id"`
	TotalVotes  int64        `json:"total_votes"`
	Options     []PollOption `json:"options"`
	IsActive    bool         `json:"is_active"`
	LastUpdated time.Time    `json:"last_updated"`
}
