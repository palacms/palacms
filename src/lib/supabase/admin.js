import { PRIVATE_SUPABASE_PRIVATE_KEY } from "$env/static/private";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { createClient } from "@supabase/supabase-js";

export default createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_PRIVATE_KEY, {
	auth: {
		persistSession: false, // This disables the warning in server environments
	},
});
