# Entity Cleaner for Home Assistant

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=1337hium&repository=Entity_Cleaner&category=integration)
[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=entity_cleaner)

Cleans up your Home Assistant Entity Registry. Find and delete "Unavailable" entities and "Orphaned" entities (ghosts) that haven't been seen for a long time.

## Features

*   🧹 **Automatic Detection:** Lists entities that are `unavailable` or `unknown`.
*   👻 **Find Ghosts:** Detects entities that exist in the registry but no longer have state objects (often left over after removing integrations).
*   ⏱️ **Filter:** Filter by days (e.g., "Show everything unavailable for more than 30 days").
*   🛡️ **Safety:** Asks if a **Backup** should be created before deleting.
*   ✅ **Bulk Delete:** Select multiple entities and delete them at once.

## Installation

### Via HACS (Recommended)

1.  Add this repository as a **Custom Repository** in HACS.
    *   HACS > Integrations > 3 dots (top right) > Custom repositories.
    *   URL: `https://github.com/1337hium/Entity_Cleaner`
    *   Category: **Integration**.
2.  Click "Download".
3.  Restart Home Assistant.

### Manual

1.  Upload the `custom_components/entity_cleaner` folder to your `config/custom_components/` directory.
2.  Restart Home Assistant.

## Configuration

This integration does not require YAML configuration. It automatically adds an entry to the sidebar (visible to administrators only).

1.  After restarting, go to **Settings > Devices & Services > Add Integration**.
2.  Search for **"Entity Cleaner"**.
3.  Click to install.
4.  The "Entity Cleaner" entry will appear in your sidebar.
    *(If the icon doesn't appear immediately, clear your browser cache).*

## Usage

1.  Open the "Entity Cleaner" panel.
2.  Set the number of days at the top (Default: 0). Entities unavailable for less than this time are hidden.
3.  Click "Refresh".
4.  Select the entities you want to delete.
5.  Click "Delete".
6.  Confirm the dialog. **Recommendation:** Choose "OK" to create a backup first.

## Notes

*   **"Inactive since":** Home Assistant stores the "unavailable" status in the state machine cache only until the next restart. If you restart HA, `last_changed` is reset. Entities that have no status at all ("orphaned") are always displayed.
*   **Backup:** The backup function uses the native `backup.create` service. Depending on your system, this may take a few seconds to minutes.

## License

MIT