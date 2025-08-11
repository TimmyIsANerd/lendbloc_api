curl 'https://api.twilio.com/2010-04-01/Accounts/AC5de9c6e08898b6e64794a4312ee22acd/Messages.json' -X POST \
--data-urlencode 'To=+19042939555' \
--data-urlencode 'From=+18885743795' \
--data-urlencode 'Body=Helllo' \
-u AC5de9c6e08898b6e64794a4312ee22acd:[AuthToken]