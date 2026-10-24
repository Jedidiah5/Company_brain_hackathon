# Signal Hunter demo journey

Start locally at http://127.0.0.1:3000. Server credentials stay in `.env`; local treg access uses `treg login`. A hosted deployment needs its own server-side `OPENAI_API_KEY` and `TREG_TOKEN`, plus `TREG_ORG` when using a personal token.

1. Click **Company website**, enter `https://jumpstart-uk.com`, then **Build my company brain**. This reads the actual website and generates a profile and LinkedIn queries. Creating a new company workspace clears the previous queue after the new brain succeeds.
2. Show what Jumpstart sells, its ideal buyer, the buyer pain, the disqualification rules and the website excerpt. Click **Find LinkedIn buying signals**. The current company profile drives scoring; it does not use the old file's profile.
3. Review the returned counts. Open a qualified signal. Show intent, fit, urgency, the exact quote and why it qualified. Filtered posts remain visible with reasons. If no strong leads are found, say so and refine the search; never lower the qualification threshold.
4. Click **Open original LinkedIn post** to show the message in its original context. Click **Open LinkedIn profile to connect**. A new tab opens; the app keeps the selected signal and your notes.
5. Send a connection request manually on LinkedIn if appropriate. Signal Hunter never sends it. Return to the app and choose **I sent a request** or **Already connected**. This is your confirmation, not an API-verified status.
6. Add a follow-up note, then click **Add to my prospects**. The person appears in **My prospects** with their connection state. Open the prospect again to update notes, edit an eligible draft or change follow-up status.
7. Reload the app to show that the company brain, results, prospects, notes, drafts and confirmed connection status persist on this device. Use **Export workspace** to download the data.

Two generated queries cost up to the listed $0.008 for search, plus OpenAI processing. Actual results and costs vary. Searches run only when clicked. The free website reader does not automatically switch to a paid provider if the page is unavailable.

For an offline rehearsal, use **Open the previous run instead**. It opens the local `leads.json` or an explicitly marked sample fixture if that file is missing. Do not describe the sample as live data. Never send real outreach just to rehearse the demo.

Claims and saved prospects are local to one device, not a shared CRM. Build stops 15:00 London; record by 15:30, submit by 15:45. Say out loud: “A human reviews and sends every message.”
