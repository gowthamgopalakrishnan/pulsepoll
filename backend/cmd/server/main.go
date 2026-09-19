package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"live-polling-backend/internal/config"
	"live-polling-backend/internal/database"
	"live-polling-backend/internal/handlers"
	"live-polling-backend/internal/middleware"
	"live-polling-backend/internal/services"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 1. Initialize MongoDB
	mongoDB := database.ConnectMongo(cfg)

	// 2. Initialize Redis
	redisService := database.ConnectRedis(cfg)

	// 3. Start Real-time WebSocket Hub
	hubCtx, hubCancel := context.WithCancel(context.Background())
	defer hubCancel()

	realtimeHub := services.NewRealtimeHub(redisService)
	go realtimeHub.Run(hubCtx)

	// 4. Initialize Handlers
	authHandler := handlers.NewAuthHandler(cfg, mongoDB)
	pollHandler := handlers.NewPollHandler(mongoDB, redisService, realtimeHub)
	voteHandler := handlers.NewVoteHandler(mongoDB, redisService, realtimeHub)
	wsHandler := handlers.NewWSHandler(mongoDB, redisService, realtimeHub)

	// 5. Setup Gin Router
	router := gin.Default()
	router.Use(middleware.CORSMiddleware(cfg.CORSOrigin))

	// Health Check
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"timestamp": time.Now().Format(time.RFC3339),
			"mongodb": gin.H{
				"connected": mongoDB.IsConnected,
			},
			"redis": gin.H{
				"connected": redisService.IsAvailable,
			},
		})
	})

	// Public Authentication Routes
	authRoutes := router.Group("/api/auth")
	{
		authRoutes.POST("/register", authHandler.Register)
		authRoutes.POST("/login", authHandler.Login)
	}

	// Public Poll & Voting Routes
	router.GET("/api/polls/:id", pollHandler.GetPoll)
	router.POST("/api/polls/:id/vote", voteHandler.CastVote)
	router.GET("/api/polls/:id/has-voted", voteHandler.CheckVoteStatus)

	// Real-Time WebSocket Route
	router.GET("/ws/polls/:id", wsHandler.StreamPoll)

	// Protected Routes (JWT required)
	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg))
	{
		protected.GET("/auth/me", authHandler.GetMe)
		protected.POST("/polls", pollHandler.CreatePoll)
		protected.GET("/polls", pollHandler.GetUserPolls)
		protected.PATCH("/polls/:id/status", pollHandler.UpdatePollStatus)
		protected.DELETE("/polls/:id", pollHandler.DeletePoll)
	}

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		log.Printf("🚀 Live Polling Backend running on http://localhost:%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server listen failed: %s\n", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exiting")
}
