package middleware

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORSMiddleware(allowedOrigin string) gin.HandlerFunc {
	config := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	if allowedOrigin != "*" && allowedOrigin != "" {
		config.AllowOrigins = []string{allowedOrigin, "http://localhost:5173", "http://localhost:3000"}
	} else {
		// Allow all origins by dynamically reflecting the request origin,
		// ensuring W3C browser compatibility when AllowCredentials is true
		config.AllowOriginFunc = func(origin string) bool {
			return true
		}
	}

	return cors.New(config)
}
