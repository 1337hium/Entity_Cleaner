import logging
import os
import voluptuous as vol
from datetime import datetime, timedelta

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers import config_validation as cv
from homeassistant.components import websocket_api
from homeassistant.components.frontend import async_register_built_in_panel, async_remove_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.typing import ConfigType
from homeassistant.util import dt as dt_util
from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Entity Cleaner component (YAML fallback)."""
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Entity Cleaner from a config entry."""
    
    # 1. Registriere statischen Pfad
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                "/entity_cleaner_files",
                FRONTEND_DIR,
                cache_headers=False
            )
        ]
    )

    # 2. Registriere das Panel
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Entity Cleaner",
        sidebar_icon="hass:broom",
        frontend_url_path="entity-cleaner",
        config={
            "_panel_custom": {
                "name": "entity-cleaner-panel",
                "embed_iframe": False,
                "trust_external": False,
                "js_url": "/entity_cleaner_files/main.js?v=7",
            }
        },
        require_admin=True,
    )

    # 3. Registriere Websocket Commands
    # Wir fangen Fehler ab, falls sie durch Reload doppelt registriert werden
    try:
        websocket_api.async_register_command(hass, ws_get_candidates)
        websocket_api.async_register_command(hass, ws_delete_entities)
        websocket_api.async_register_command(hass, ws_create_backup)
        websocket_api.async_register_command(hass, ws_get_info)
    except Exception:
        pass # Bereits registriert

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    async_remove_panel(hass, "entity-cleaner")
    # Websocket commands lassen sich schwer deregistrieren, stören aber nicht
    return True

@websocket_api.websocket_command({
    vol.Required("type"): "entity_cleaner/get_info",
})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_get_info(hass, connection, msg):
    """Gibt Infos zurück (z.B. letztes Backup)."""
    last_backup_auto = None
    last_backup_manual = None
    
    try:
        backups_found = []

        # 1. Versuche Core Backup Integration
        manager = hass.data.get("backup")
        if manager:
            backups = None
            if hasattr(manager, "async_get_backups"):
                backups = await manager.async_get_backups()
            elif hasattr(manager, "get_backups"):
                backups = await manager.get_backups()
            elif hasattr(manager, "backups"):
                backups = manager.backups
            
            if backups:
                backups_found = list(backups.values()) if isinstance(backups, dict) else list(backups)

        # 2. Fallback: Versuche sensor.backup_state
        if not backups_found:
            state = hass.states.get("sensor.backup_state")
            if state and state.attributes.get("backups"):
                b_list = state.attributes["backups"]
                if isinstance(b_list, list):
                    backups_found = b_list

        # 3. Verarbeite gefundene Backups
        if backups_found:
            def get_date(b):
                if isinstance(b, dict):
                    return b.get("date")
                return getattr(b, "date", None)
            
            def get_name(b):
                if isinstance(b, dict):
                    return b.get("name", "")
                return getattr(b, "name", "")

            # Sortiere alle nach Datum (neuestes zuerst)
            valid_backups = [b for b in backups_found if get_date(b) is not None]
            valid_backups.sort(key=lambda x: get_date(x), reverse=True)
            
            for b in valid_backups:
                d_val = get_date(b)
                d_str = d_val.isoformat() if hasattr(d_val, "isoformat") else str(d_val)
                name = get_name(b)
                
                if name == "Entity Cleaner Auto-Backup":
                    if not last_backup_auto: 
                        last_backup_auto = d_str
                else:
                    if not last_backup_manual:
                        last_backup_manual = d_str
                
                if last_backup_auto and last_backup_manual:
                    break

    except Exception as e:
        _LOGGER.warning("Konnte Backup-Infos nicht abrufen: %s", e)

    connection.send_result(msg["id"], {
        "last_backup_auto": last_backup_auto,
        "last_backup_manual": last_backup_manual
    })

@websocket_api.websocket_command({
    vol.Required("type"): "entity_cleaner/get_candidates",
    vol.Optional("days", default=0): int, 
})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_get_candidates(hass, connection, msg):
    """Listet Entities auf, die unavailable sind."""
    days_threshold = msg["days"]
    registry = er.async_get(hass)
    
    candidates = []
    now = dt_util.utcnow()

    for entity_id, entry in registry.entities.items():
        if entry.disabled_by is not None:
            continue 

        state_obj = hass.states.get(entity_id)
        
        info = {
            "entity_id": entity_id,
            "name": entry.name or entry.original_name or entity_id,
            "platform": entry.platform,
            "status": "active",
            "last_changed": None,
            "days_unavailable": -1
        }

        is_candidate = False

        if state_obj is None:
            info["status"] = "orphaned"
            info["days_unavailable"] = 9999
            is_candidate = True
        
        elif state_obj.state in [STATE_UNAVAILABLE, STATE_UNKNOWN]:
            info["status"] = state_obj.state
            
            if state_obj.last_changed:
                diff = now - state_obj.last_changed
                info["days_unavailable"] = diff.days
                info["last_changed"] = state_obj.last_changed.isoformat()
                
                if info["days_unavailable"] >= days_threshold:
                    is_candidate = True
            else:
                is_candidate = True
        
        if is_candidate:
            candidates.append(info)

    candidates.sort(key=lambda x: x["days_unavailable"], reverse=True)
    connection.send_result(msg["id"], {"candidates": candidates})


@websocket_api.websocket_command({
    vol.Required("type"): "entity_cleaner/delete",
    vol.Required("entity_ids"): [str],
})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete_entities(hass, connection, msg):
    """Löscht die ausgewählten Entities aus der Registry."""
    entity_ids = msg["entity_ids"]
    registry = er.async_get(hass)
    
    deleted = []
    errors = []

    for eid in entity_ids:
        try:
            if registry.async_is_registered(eid):
                registry.async_remove(eid)
                deleted.append(eid)
            else:
                errors.append(f"{eid} not found in registry")
        except Exception as e:
            errors.append(f"Error removing {eid}: {str(e)}")

    connection.send_result(msg["id"], {
        "deleted": deleted,
        "errors": errors
    })

@websocket_api.websocket_command({
    vol.Required("type"): "entity_cleaner/backup",
})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_create_backup(hass, connection, msg):
    """Triggered ein Backup."""
    _LOGGER.info("Entity Cleaner: Backup-Anfrage erhalten.")
    
    # Diagnose: Welche Services sehen wir?
    available_services = []
    if hass.services.has_service("hassio", "backup_full"): available_services.append("hassio.backup_full")
    if hass.services.has_service("hassio", "backup_partial"): available_services.append("hassio.backup_partial")
    if hass.services.has_service("backup", "create"): available_services.append("backup.create")
    
    debug_msg = f"Services: {', '.join(available_services)}. Modus: Blocking=True, Context=User"
    
    await hass.services.async_call(
        "persistent_notification", 
        "create", 
        {
            "title": "Entity Cleaner Backup V6",
            "message": debug_msg,
            "notification_id": "entity_cleaner_debug"
        }
    )

    try:
        service_called = False
        # Context holen damit Supervisor weiß wer es aufruft
        ctx = connection.context(msg)
        
        # 1. Versuche 'hassio.backup_full' (Supervisor - BEVORZUGT)
        if hass.services.has_service("hassio", "backup_full"):
             _LOGGER.info("Rufe hassio.backup_full auf...")
             await hass.services.async_call(
                 "hassio", 
                 "backup_full", 
                 {"name": "Entity Cleaner Auto-Backup"},
                 blocking=True, # WICHTIG: Warte auf Rückmeldung/Fehler!
                 context=ctx
             )
             service_called = True
             
        # 2. Versuche 'hassio.backup_partial'
        elif hass.services.has_service("hassio", "backup_partial"):
             _LOGGER.info("Rufe hassio.backup_partial auf...")
             await hass.services.async_call(
                 "hassio", 
                 "backup_partial", 
                 {
                     "name": "Entity Cleaner Auto-Backup", 
                     "homeassistant": True
                 },
                 blocking=True,
                 context=ctx
             )
             service_called = True

        # 3. Versuche Standard 'backup.create' (Core)
        elif hass.services.has_service("backup", "create"):
            _LOGGER.info("Rufe backup.create auf...")
            await hass.services.async_call(
                "backup", 
                "create", 
                {"name": "Entity Cleaner Auto-Backup"},
                blocking=True,
                context=ctx
            ) 
            service_called = True

        if not service_called:
             connection.send_error(msg["id"], "no_backup_service", "Kein Backup-Service (hassio/backup) gefunden.")
             return

        # 2. Erfolg
        await hass.services.async_call(
            "persistent_notification", 
            "create", 
            {
                "title": "Entity Cleaner Backup Erfolg",
                "message": "Der Backup-Service hat die Ausführung erfolgreich bestätigt (Blocking Call returned).",
                "notification_id": "entity_cleaner_debug"
            }
        )

        connection.send_result(msg["id"], {"success": True})
        
    except Exception as e:
        _LOGGER.exception("Fehler beim Erstellen des Backups")
        connection.send_error(msg["id"], "backup_failed", str(e))
        
        await hass.services.async_call(
            "persistent_notification", 
            "create", 
            {
                "title": "Entity Cleaner Backup Fehler",
                "message": f"Fehler beim Blocking-Call: {str(e)}",
                "notification_id": "entity_cleaner_debug"
            }
        )