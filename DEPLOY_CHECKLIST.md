# Chief-AI-Arti — Deployment Checklist

## Before First Deploy

### Secrets & Keys
- [ ] RAZORPAY_WEBHOOK_SECRET — get from Razorpay Dashboard → Webhooks
- [ ] RAZORPAY_PLAN_ID — create plan in Razorpay Dashboard → Subscriptions → Plans (₹150/mo)
- [ ] All other REPLACE_ME values in .env.local filled

### Models (verified working on this account)
- [x] OPENAI_CHAT_MODEL=gpt-4o ✅ verified
- [x] OPENAI_VISION_MODEL=gpt-4o-mini ✅ verified
- [x] OPENAI_SUMMARY_MODEL=gpt-4o-mini ✅ verified
- [x] OPENAI_EMBEDDING_MODEL=text-embedding-3-small ✅ verified

### Infrastructure
- [x] Supabase project: Mumbai (ap-south-1) ✅
- [x] 50 recipes + 116 knowledge_docs seeded with embeddings ✅
- [x] match_recipes + match_knowledge_docs RPCs deployed ✅
- [ ] PWA icons replaced with real branded icons (current: placeholders)

## Vercel Setup
- [ ] Install Vercel CLI: npm i -g vercel
- [ ] vercel login
- [ ] vercel --prod (from project root)
- [ ] Add ALL .env.local variables to Vercel dashboard (Settings → Environment Variables)
- [ ] Set NEXT_PUBLIC_APP_URL to your Vercel deployment URL

## After First Deploy
- [ ] Set Razorpay webhook URL: https://[your-vercel-url]/api/webhooks/razorpay
      Events to subscribe: subscription.activated, subscription.charged, subscription.cancelled, subscription.expired
- [ ] Test payment with Razorpay test card: 4111 1111 1111 1111, any future expiry, any CVV
- [ ] Verify subscription_status flips to 'paid' in Supabase users table after test payment
- [ ] Verify PortionSlider shows max 15 for paid user
- [ ] Verify WhatsApp share works for paid user
- [ ] Verify chat rate limit shows "unlimited" for paid user (currently shows 3/day)
- [ ] Test "Add to Home Screen" on Android Chrome

## Switching to Production
- [ ] Get Razorpay LIVE keys (rzp_live_) — only after full test flow works
- [ ] Update Vercel env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET to live keys
- [ ] Update RAZORPAY_WEBHOOK_SECRET to live webhook secret
- [ ] Create a LIVE Razorpay plan (separate from test plan) → update RAZORPAY_PLAN_ID
- [ ] Consider upgrading OPENAI_CHAT_MODEL if gpt-5-mini becomes available

## Cost Estimate (Phase 1, 15 users)
- Supabase Mumbai: ~$0/mo (free tier)
- Upstash Redis: ~$0/mo (free tier)
- OpenAI (gpt-4o chat, gpt-4o-mini vision): ~₹150-200/mo estimated
- Vercel: $0/mo (hobby tier)
- Razorpay: 2% per transaction (~₹3/transaction)
- **Target: profitable from user 1 at ₹150/mo**
