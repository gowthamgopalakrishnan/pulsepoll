package handlers

import (
	"net/http"
	"strings"
	"time"

	"live-polling-backend/internal/config"
	"live-polling-backend/internal/database"
	"live-polling-backend/internal/models"
	"live-polling-backend/internal/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AuthHandler struct {
	Config *config.Config
	Mongo  *database.MongoDB
}

func NewAuthHandler(cfg *config.Config, mongo *database.MongoDB) *AuthHandler {
	return &AuthHandler{
		Config: cfg,
		Mongo:  mongo,
	}
}

// Register godoc
// POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	// Check if email already registered
	existing, _ := h.Mongo.FindUserByEmail(c.Request.Context(), req.Email)
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "An account with this email address already exists"})
		return
	}

	// Hash password
	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := &models.User{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: hash,
		CreatedAt:    time.Now(),
	}

	if err := h.Mongo.CreateUser(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user account", "details": err.Error()})
		return
	}

	// Generate JWT token
	token, err := utils.GenerateToken(user.ID.Hex(), user.Email, user.Name, h.Config.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token"})
		return
	}

	var resp models.AuthResponse
	resp.Token = token
	resp.User.ID = user.ID.Hex()
	resp.User.Name = user.Name
	resp.User.Email = user.Email

	c.JSON(http.StatusCreated, resp)
}

// Login godoc
// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload", "details": err.Error()})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	user, err := h.Mongo.FindUserByEmail(c.Request.Context(), req.Email)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if !utils.CheckPasswordHash(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := utils.GenerateToken(user.ID.Hex(), user.Email, user.Name, h.Config.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token"})
		return
	}

	var resp models.AuthResponse
	resp.Token = token
	resp.User.ID = user.ID.Hex()
	resp.User.Name = user.Name
	resp.User.Email = user.Email

	c.JSON(http.StatusOK, resp)
}

// GetMe godoc
// GET /api/auth/me
func (h *AuthHandler) GetMe(c *gin.Context) {
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	oid, err := primitive.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.Mongo.FindUserByID(c.Request.Context(), oid)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         user.ID.Hex(),
		"name":       user.Name,
		"email":      user.Email,
		"created_at": user.CreatedAt,
	})
}
