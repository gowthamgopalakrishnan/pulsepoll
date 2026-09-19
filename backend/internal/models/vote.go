package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Vote struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PollID           primitive.ObjectID `bson:"poll_id" json:"poll_id"`
	OptionIDs        []string           `bson:"option_ids" json:"option_ids"`
	VoterFingerprint string             `bson:"voter_fingerprint" json:"voter_fingerprint"`
	IPAddress        string             `bson:"ip_address" json:"ip_address"`
	CreatedAt        time.Time          `bson:"created_at" json:"created_at"`
}

type CastVoteRequest struct {
	OptionIDs        []string `json:"option_ids" binding:"required,min=1"`
	VoterFingerprint string   `json:"voter_fingerprint" binding:"required,min=4,max=128"`
}

type CheckVoteResponse struct {
	HasVoted  bool     `json:"has_voted"`
	OptionIDs []string `json:"option_ids,omitempty"`
}
