-- Grant execute permission on the donation sync trigger function to authenticated users.
-- Although the function is SECURITY DEFINER, the triggering user still requires EXECUTE 
-- privileges on the trigger function itself for the INSERT statement to succeed.
GRANT EXECUTE ON FUNCTION public.donations_sync_raised() TO authenticated;
