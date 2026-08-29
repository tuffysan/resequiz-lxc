# Resequiz 17.7.0 – Admin Account Login

- Första adminbesöket verifieras med installationsnyckeln.
- Därefter skapas ett administratörskonto med användarnamn och lösenord.
- Lösenord lagras aldrig i klartext; scrypt + slumpmässigt salt används.
- HttpOnly-session används för Admin, Statistik, Studio och ligadministration.
- Adminnyckeln används inte längre vid vanlig inloggning och skickas inte i URL/localStorage.
- Konto kan återställas med installationsnyckeln om lösenordet glöms.
- Inloggad administratör kan byta lösenord och logga ut.
- Login/setup/recovery är rate-limitade.
