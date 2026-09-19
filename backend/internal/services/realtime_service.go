package services

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"live-polling-backend/internal/database"
	"live-polling-backend/internal/models"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for WebSocket connections
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Client struct {
	PollID string
	Conn   *websocket.Conn
	Send   chan []byte
	Hub    *RealtimeHub
}

type RealtimeHub struct {
	Redis        *database.RedisService
	mu           sync.RWMutex
	pollClients  map[string]map[*Client]bool
	pollSubs     map[string]func() // cleanup functions for Redis Pub/Sub subscriptions
	register     chan *Client
	unregister   chan *Client
	broadcast    chan struct {
		PollID  string
		Message []byte
	}
}

func NewRealtimeHub(redis *database.RedisService) *RealtimeHub {
	return &RealtimeHub{
		Redis:       redis,
		pollClients: make(map[string]map[*Client]bool),
		pollSubs:    make(map[string]func()),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		broadcast: make(chan struct {
			PollID  string
			Message []byte
		}),
	}
}

func (h *RealtimeHub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return

		case client := <-h.register:
			h.mu.Lock()
			if h.pollClients[client.PollID] == nil {
				h.pollClients[client.PollID] = make(map[*Client]bool)

				// First client for this poll: subscribe to Redis Pub/Sub channel
				ch, cleanup, err := h.Redis.SubscribeToPollUpdates(ctx, client.PollID)
				if err != nil {
					log.Printf("Error subscribing to Redis channel for poll %s: %v", client.PollID, err)
				} else {
					h.pollSubs[client.PollID] = cleanup
					// Listen on the Redis subscription channel
					go h.listenRedisChannel(client.PollID, ch)
				}
			}
			h.pollClients[client.PollID][client] = true
			clientCount := len(h.pollClients[client.PollID])
			h.mu.Unlock()
			log.Printf("Client connected to poll %s (Active viewers on this node: %d)", client.PollID, clientCount)

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.pollClients[client.PollID]; ok {
				if _, found := clients[client]; found {
					delete(clients, client)
					close(client.Send)
					if len(clients) == 0 {
						delete(h.pollClients, client.PollID)
						if cleanup, hasCleanup := h.pollSubs[client.PollID]; hasCleanup {
							cleanup()
							delete(h.pollSubs, client.PollID)
						}
					}
				}
			}
			h.mu.Unlock()
			log.Printf("Client disconnected from poll %s", client.PollID)

		case b := <-h.broadcast:
			h.mu.RLock()
			clients := h.pollClients[b.PollID]
			for client := range clients {
				select {
				case client.Send <- b.Message:
				default:
					close(client.Send)
					delete(clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *RealtimeHub) listenRedisChannel(pollID string, ch <-chan string) {
	for msg := range ch {
		h.broadcast <- struct {
			PollID  string
			Message []byte
		}{
			PollID:  pollID,
			Message: []byte(msg),
		}
	}
}

// BroadcastLocal dispatches a message to local clients without redis delay
func (h *RealtimeHub) BroadcastLocal(pollID string, payload *models.PollResultsPayload) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.broadcast <- struct {
		PollID  string
		Message []byte
	}{
		PollID:  pollID,
		Message: data,
	}
}

func (h *RealtimeHub) HandleWebSocket(w http.ResponseWriter, r *http.Request, pollID string, initialPayload *models.PollResultsPayload) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := &Client{
		PollID: pollID,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		Hub:    h,
	}

	h.register <- client

	// Send current poll results immediately upon connection so viewer sees current state instantly
	if initialPayload != nil {
		if data, err := json.Marshal(initialPayload); err == nil {
			_ = client.Conn.WriteMessage(websocket.TextMessage, data)
		}
	}

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)
	_ = c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)

			// Add queued chat messages to the current websocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				_, _ = w.Write([]byte{'\n'})
				_, _ = w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
