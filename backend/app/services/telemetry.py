"""Real-time WebSocket telemetry connection manager."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket


class TelemetryManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, event: dict[str, Any]) -> None:
        if not self._connections:
            return
        payload = {
            **event,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "active_connections": len(self._connections),
        }
        stale: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self._connections.discard(ws)


telemetry_manager = TelemetryManager()
