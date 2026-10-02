import { sendContactMessage } from "../auth/emailService.js";

// POST /contact — public. Delivers to CONTACT_EMAIL. Without it the form refuses
// rather than pretending to send, which is what the page used to do.
// `send` is injectable so the handler can be tested without a mail provider.
export function contactHandler(send = sendContactMessage) {
  return async (req, res) => {
    try {
      const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
      const message = {
        name: str(req.body?.name, 120),
        email: str(req.body?.email, 200),
        subject: str(req.body?.subject, 60) || "general",
        body: str(req.body?.message, 5000),
      };
      // Honeypot: a field people never see. Bots fill it; answer as sent and drop it.
      if (str(req.body?.website, 200)) return res.json({ message: "Message sent." });
      if (!message.name || !message.body)
        return res.status(400).json({ error: "Please add your name and a message." });
      if (!/^\S+@\S+\.\S+$/.test(message.email))
        return res.status(400).json({ error: "Please enter a valid email address so we can reply." });
      if (!process.env.CONTACT_EMAIL)
        return res.status(503).json({ error: "The contact form is not set up yet. Please try again later." });
      await send(message);
      res.json({ message: "Message sent." });
    } catch (err) {
      console.error("[Contact] send failed:", err?.message || err);
      res.status(502).json({ error: "Your message could not be sent. Please try again." });
    }
  };
}
