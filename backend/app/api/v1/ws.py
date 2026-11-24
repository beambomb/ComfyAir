import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.telemetry import telemetry_manager

router = APIRouter(tags=["Telemetry"])


@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await telemetry_manager.connect(websocket)
    try:
        await websocket.send_json(
            {
                "type": "welcome",
                "message": "ComfyAir Telemetry Connected",
                "active_connections": telemetry_manager.connection_count,
                "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            }
        )
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                msg = {"type": raw.strip()}

            if isinstance(msg, dict) and msg.get("type") == "ping":
                await websocket.send_json(
                    {
                        "type": "pong",
                        "active_connections": telemetry_manager.connection_count,
                        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    }
                )
            else:
                await websocket.send_json(
                    {
                        "type": "ack",
                        "echo": msg,
                        "active_connections": telemetry_manager.connection_count,
                        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    }
                )
    except WebSocketDisconnect:
        telemetry_manager.disconnect(websocket)
    except Exception:
        telemetry_manager.disconnect(websocket)
