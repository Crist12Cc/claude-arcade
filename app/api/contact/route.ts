import { Resend } from "resend";

// RESEND_API_KEY debe definirse en `.env.local` (no versionado).
const RECIPIENT_EMAIL = "ccomayagua@redserfinsa.com";
const SENDER_EMAIL = "onboarding@resend.dev";

type ContactPayload = {
  name: string;
  email: string;
  message: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ContactPayload>;
  const { name, email, message } = body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return Response.json(
      { error: "Todos los campos son obligatorios." },
      { status: 400 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: SENDER_EMAIL,
    to: RECIPIENT_EMAIL,
    subject: `Nuevo mensaje de contacto de ${name.trim()}`,
    text: `Nombre: ${name.trim()}\nCorreo: ${email.trim()}\n\nMensaje:\n${message.trim()}`,
    replyTo: email.trim(),
  });

  if (error) {
    return Response.json(
      { error: "No se pudo enviar el mensaje. Intenta de nuevo." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
