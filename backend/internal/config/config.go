package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	MongoURI    string
	MongoDBName string
	RedisURI    string
	JWTSecret   string
	CORSOrigin  string
	Environment string
}

func LoadConfig() *Config {
	// Attempt to load .env file; continue without error if not found (e.g. In Docker/production)
	if err := godotenv.Load(); err != nil {
		log.Println("Note: No .env file found or error loading, using system environment variables")
	}

	port := getEnv("PORT", "8080")
	mongoURI := getEnv("MONGO_URI", "mongodb://localhost:27017")
	mongoDBName := getEnv("MONGO_DB_NAME", "live_polling_db")
	redisURI := getEnv("REDIS_URI", "redis://localhost:6379")
	jwtSecret := getEnv("JWT_SECRET", "super-secret-jwt-key-for-live-polling-dev")
	corsOrigin := getEnv("CORS_ORIGIN", "*")
	env := getEnv("ENV", "development")

	return &Config{
		Port:        port,
		MongoURI:    mongoURI,
		MongoDBName: mongoDBName,
		RedisURI:    redisURI,
		JWTSecret:   jwtSecret,
		CORSOrigin:  corsOrigin,
		Environment: env,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
