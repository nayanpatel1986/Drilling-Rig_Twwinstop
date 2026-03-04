/**
 * useRealtimeData Hook - WebSocket-based Real-Time Data Streaming
 * 
 * Replaces polling-based approach with WebSocket push updates
 * Target: <100ms latency from sensor to dashboard
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getRigData } from '../api';

export function useRealtimeData(options = {}) {
    const {
        autoReconnect = true,
        reconnectDelay = 2000,
        maxReconnectAttempts = 5,
        fallbackPollingInterval = 2000
    } = options;

    const [data, setData] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [latency, setLatency] = useState(null);
    const [messageCount, setMessageCount] = useState(0);
    
    const wsRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const fallbackIntervalRef = useRef(null);
    const pingIntervalRef = useRef(null);
    const lastDataTimeRef = useRef(null);

    /**
     * Calculate data latency
     */
    const calculateLatency = useCallback((dataTime) => {
        if (!dataTime) return null;
        
        try {
            const now = new Date().getTime();
            const dataTimestamp = new Date(dataTime).getTime();
            const latencyMs = now - dataTimestamp;
            
            setLatency(prev => {
                if (prev === null) return latencyMs;
                return Math.round(prev * 0.7 + latencyMs * 0.3);
            });
            
            return latencyMs;
        } catch (e) {
            return null;
        }
    }, []);

    /**
     * Connect to WebSocket server
     */
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.CONNECTING || 
            wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setConnectionStatus('connecting');
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/realtime`;
        
        console.log(`[WebSocket] Connecting to ${wsUrl}...`);
        
        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WebSocket] Connected successfully');
                setIsConnected(true);
                setConnectionStatus('connected');
                reconnectAttempts.current = 0;
                
                ws.send(JSON.stringify({ type: 'ping' }));
                
                if (pingIntervalRef.current) {
                    clearInterval(pingIntervalRef.current);
                }
                pingIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 30000);
                
                if (fallbackIntervalRef.current) {
                    clearInterval(fallbackIntervalRef.current);
                    fallbackIntervalRef.current = null;
                }
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message._type === 'realtime_data') {
                        const latencyMs = calculateLatency(message._time || message.time);
                        
                        setData(message);
                        setMessageCount(prev => prev + 1);
                        lastDataTimeRef.current = new Date().getTime();
                        
                        if (messageCount % 100 === 0 && latency) {
                            console.log(`[WebSocket] Latency: ${latency}ms, Messages: ${messageCount}`);
                        }
                        
                    } else if (message._type === 'alarm') {
                        console.warn(`[WebSocket] ALARM: ${message.severity} - ${message.message}`);
                        
                    } else if (message.type === 'connection') {
                        console.log('[WebSocket] Connected:', message.message);
                    }
                    
                } catch (error) {
                    console.error('[WebSocket] Parse error:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
                setConnectionStatus('error');
            };

            ws.onclose = (event) => {
                console.log('[WebSocket] Closed:', event.code);
                setIsConnected(false);
                setConnectionStatus('disconnected');
                
                if (pingIntervalRef.current) {
                    clearInterval(pingIntervalRef.current);
                    pingIntervalRef.current = null;
                }
                
                if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current);
                    console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
                    
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current += 1;
                        connect();
                    }, delay);
                } else if (reconnectAttempts.current >= maxReconnectAttempts) {
                    console.warn('[WebSocket] Max reconnect attempts. Using fallback polling.');
                    startFallbackPolling();
                }
            };
            
        } catch (error) {
            console.error('[WebSocket] Error:', error);
            setConnectionStatus('error');
        }
    }, [autoReconnect, reconnectDelay, maxReconnectAttempts, calculateLatency, messageCount, latency]);

    /**
     * Fallback HTTP polling
     */
    const startFallbackPolling = useCallback(() => {
        console.log('[Fallback] Starting HTTP polling...');
        
        const poll = async () => {
            try {
                const newData = await getRigData();
                if (newData && !newData.error && !newData._WITSML_STATUS) {
                    setData(newData);
                    lastDataTimeRef.current = new Date().getTime();
                }
            } catch (error) {
                console.error('[Fallback] Error:', error);
            }
        };
        
        poll();
        
        if (fallbackIntervalRef.current) {
            clearInterval(fallbackIntervalRef.current);
        }
        fallbackIntervalRef.current = setInterval(poll, fallbackPollingInterval);
        
    }, [fallbackPollingInterval]);

    /**
     * Disconnect
     */
    const disconnect = useCallback(() => {
        console.log('[WebSocket] Disconnecting...');
        
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
        }
        if (fallbackIntervalRef.current) {
            clearInterval(fallbackIntervalRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
        }
        
        setIsConnected(false);
        setConnectionStatus('disconnected');
    }, []);

    /**
     * Initialize
     */
    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return {
        data,
        isConnected,
        connectionStatus,
        latency,
        messageCount,
        connect,
        disconnect
    };
}
