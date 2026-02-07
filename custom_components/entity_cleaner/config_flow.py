from homeassistant import config_entries
from .const import DOMAIN

class EntityCleanerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Config flow for Entity Cleaner."""
    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        # Verhindere mehrfache Installation
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(title="Entity Cleaner", data={})

        return self.async_show_form(step_id="user")
