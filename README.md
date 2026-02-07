# Entity Cleaner für Home Assistant

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=1337hium&repository=Entity_Cleaner&category=integration)
[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=entity_cleaner)

Räumt deine Home Assistant Entity Registry auf. Finde und lösche "Unavailable" Entities und "Leichen" (Orphaned Entities), die schon lange nicht mehr gesehen wurden.

## Features

*   🧹 **Automatisches Finden:** Listet Entities auf, die `unavailable` oder `unknown` sind.
*   👻 **Geister finden:** Erkennt Entities, die in der Registry stehen, aber keine State-Objekte mehr haben (oft nach Entfernen von Integrationen übrig geblieben).
*   ⏱️ **Filter:** Filtere nach Tagen (z.B. "Zeige alles, was seit 30 Tagen nicht verfügbar ist").
*   🛡️ **Sicherheit:** Fragt vor dem Löschen, ob ein **Backup** erstellt werden soll.
*   ✅ **Bulk Delete:** Wähle mehrere Entities aus und lösche sie auf einmal.

## Installation

### Via HACS (Empfohlen)

1.  Füge dieses Repository als **Custom Repository** in HACS hinzu.
    *   HACS > Integrationen > 3 Punkte oben rechts > Benutzerdefinierte Repositories.
        * URL: `https://github.com/1337hium/Entity_Cleaner` (oder Pfad zu diesem Repo).
    *   Kategorie: **Integration**.
2.  Klicke auf "Herunterladen".
3.  Starte Home Assistant neu.

### Manuell

1.  Lade den Ordner `custom_components/entity_cleaner` in deinen `config/custom_components/` Ordner hoch.
2.  Starte Home Assistant neu.

## Konfiguration

Diese Integration benötigt keine YAML-Konfiguration. Sie fügt automatisch einen Eintrag in die Seitenleiste ein (nur für Administratoren sichtbar).

1.  Gehe nach dem Neustart in die Seitenleiste und klicke auf **"Entity Cleaner"**.
    *(Falls das Icon nicht erscheint, leere deinen Browser-Cache).*

## Nutzung

1.  Öffne das Panel "Entity Cleaner".
2.  Stelle oben die Anzahl der Tage ein (Standard: 7). Entities, die kürzer als diese Zeit "unavailable" sind, werden ausgeblendet.
3.  Klicke auf "Aktualisieren".
4.  Wähle die Entities aus, die du löschen möchtest.
5.  Klicke auf "Löschen".
6.  Bestätige den Dialog. **Empfehlung:** Wähle "OK", um vorher ein Backup zu erstellen.

## Hinweise

*   **"Inaktiv seit":** Home Assistant speichert den Status "unavailable" im State Machine Cache nur bis zum nächsten Neustart. Wenn du HA neu startest, wird `last_changed` zurückgesetzt. Entities, die gar keinen Status haben ("orphaned"), werden immer angezeigt.
*   **Backup:** Die Backup-Funktion nutzt den nativen `backup.create` Service. Das dauert je nach System einige Sekunden bis Minuten.

## Lizenz

MIT
