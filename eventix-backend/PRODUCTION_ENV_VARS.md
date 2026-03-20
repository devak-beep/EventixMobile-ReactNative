# Required Vercel Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

## Critical
- `NODE_ENV` = `production`
- `MONGO_URI` = `mongodb+srv://eventix-admin:Devak%409354@eventix-clustera.pw4gnev.mongodb.net/event_booking?retryWrites=true&w=majority&maxPoolSize=1`
- `FRONTEND_URL` = `https://eventix-frontend-8v2j.vercel.app`

## Existing (verify these exist)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `EMAIL_USER`
- `EMAIL_PASS`

## Security Notes
1. Never commit secrets to git
2. Rotate keys regularly
3. Use different credentials for dev/staging/prod
4. Monitor MongoDB Atlas for unusual connection patterns

## After adding variables
1. Redeploy with "Clear build cache"
2. Test all endpoints
3. Monitor logs for connection errors
