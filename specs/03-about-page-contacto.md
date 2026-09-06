# SPEC 03 — Página "Acerca de" y envío de correo de contacto

**Estado:** Aprobado
**Depende de:** SPEC 02
**Fecha:** 2026-09-06

**Objetivo:** Migrar la pantalla "Acerca de" de `references/about/about.jsx` a `/about`, agregar el link "Acerca de" al Nav, y conectar el formulario de contacto a un endpoint server-side que envía el mensaje por correo usando Resend.
n

## Alcance

**Incluye:**

- Nueva pantalla **About** (`/about`) migrada de `references/about/about.jsx`, con:
  - Sección hero ("ACERCA DE ARCADE VAULT") con kicker, título, párrafo de misión y fila de 3 highlights (`HighlightIcon`: HEART, BROWSER, PLANT) con animación de entrada escalonada.
  - Divider decorativo animado (`.about-divider`, pixels con `animationDelay`).
  - Sección de contacto (`CONTÁCTANOS`) con intro + tips (respuesta en 24-48h, sugerencias bienvenidas, sin spam) y formulario (nombre, correo, mensaje).
  - Animación de entrada por scroll (`.reveal`/`.in` vía `IntersectionObserver`), igual patrón que `Home.tsx` (SPEC 02).
- Envío real de correo del formulario de contacto:
  - Nuevo Route Handler `app/api/contact/route.ts` que recibe `POST` con `{ name, email, message }`, valida que los tres campos no estén vacíos, y llama a la API de Resend server-side.
  - El formulario (`components/About.tsx`) hace `fetch("/api/contact", { method: "POST", ... })` en `onSubmit` en vez de solo actualizar estado local.
  - Estados del formulario: `idle` (campos vacíos → shake, igual que el template), `sending` (deshabilita el botón mientras espera respuesta), `sent` (terminal-success, igual que el template), y **nuevo estado `error`** (mensaje visible debajo del formulario si el POST falla, con opción de reintentar sin perder lo escrito).
  - Remitente: dirección de dominio de prueba de Resend (`onboarding@resend.dev`).
  - Destinatario: correo del dueño del proyecto (`ccomayagua@redserfinsa.com`), hardcodeado en el route handler.
  - Variable de entorno `RESEND_API_KEY` documentada (en `.env.local`, no versionada); el route handler la lee de `process.env.RESEND_API_KEY`.
- Dependencia nueva: paquete npm `resend` agregado a `package.json`.
- Actualizar `components/Nav.tsx`:
  - Agregar link "Acerca de" apuntando a `/about`, resaltado solo en esa ruta exacta, tanto en la barra superior como en el panel móvil (mismo patrón que el link "Inicio" del SPEC 02).
- Estilos: portar a `app/globals.css` las clases usadas por `about.jsx` presentes en `references/about/styles.css` (`.about-*`, `.contact-*`, `.highlight*`, `.hl-*`, `.field`, `.terminal-success`, `.term-*`, `.tip*`, etc.), incluyendo el nuevo estado visual de error del formulario.

**No incluye:**

- Persistencia de los mensajes de contacto en base de datos: el mensaje solo se envía por correo, no se guarda en ningún lado.
- Autenticación, rate limiting o protección anti-spam (captcha, honeypot) del endpoint `/api/contact`: queda fuera de este spec, se puede agregar en uno futuro si se detecta abuso.
- Dominio propio verificado en Resend: se usa el dominio de pruebas `onboarding@resend.dev`; migrar a un dominio propio es una tarea futura del usuario en el dashboard de Resend, no de este spec.
- Reenvío automático o cola de reintentos si Resend falla: el único mecanismo de reintento es que el usuario presione "Enviar mensaje" de nuevo manualmente.
- Cambios a las pantallas Home, Biblioteca, Detalle, Reproductor, Login o Salón (SPECs 01 y 02), salvo el link nuevo en el Nav.
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

No se introduce ningún tipo de datos persistente. El único "modelo" es el payload transitorio del formulario:

```ts
type ContactPayload = {
  name: string;
  email: string;
  message: string;
};
```

Este tipo vive junto al route handler (`app/api/contact/route.ts`) y/o `components/About.tsx`, sin exportarse a `lib/data.ts` (no es un dato del dominio del juego, es solo el contrato del endpoint).

## Plan de implementación

1. **Instalar dependencia.** Agregar `resend` a `package.json` (`npm install resend`). Sistema funcional: build sigue pasando, sin efecto visible aún.
2. **Estilos de About.** Portar a `app/globals.css` las clases de `references/about/styles.css` usadas por `about.jsx` (listadas en Alcance), incluyendo un estilo nuevo para el mensaje de error del formulario (puede reutilizar la paleta de `.shake`/estados existentes). Sistema funcional: build sigue pasando, sin efecto visible aún.
3. **Route handler de contacto.** Crear `app/api/contact/route.ts`: recibe `POST`, valida `name`/`email`/`message` no vacíos (400 si falla), instancia `Resend` con `process.env.RESEND_API_KEY`, envía el correo (`from: "onboarding@resend.dev"`, `to: "ccomayagua@redserfinsa.com"`, asunto y cuerpo incluyendo los datos del formulario), responde 200 en éxito o 500 con mensaje de error si Resend falla. Documentar `RESEND_API_KEY` en un bloque de comentario o en el propio archivo indicando que debe definirse en `.env.local`. Sistema funcional: el endpoint es invocable de forma aislada (curl/Postman) aunque nada del frontend lo llame todavía.
4. **Componente About.** Crear `components/About.tsx` (client component) migrando `about.jsx`: `useEffect` de `IntersectionObserver` para `.reveal`, estado del formulario (`idle`/`sending`/`sent`/`error`), `HighlightIcon`. El `onSubmit` pasa a: validar campos vacíos (shake, igual que el template) → `setSending(true)` → `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })` → en éxito `setSent(form.name.trim())`, en fallo `setError(true)` manteniendo `form` intacto para reintentar. Sistema funcional: `components/About.tsx` existe y compila, aunque no esté enrutado todavía.
5. **Ruta `/about`.** Crear `app/about/page.tsx` que renderiza `<About />`. Sistema funcional: `/about` muestra la pantalla completa (hero, divider, contacto) y el formulario envía correos reales si `RESEND_API_KEY` está configurada.
6. **Actualizar Nav.** En `components/Nav.tsx`: agregar el link "Acerca de" (`/about`, activo solo en `pathname === "/about"`) en la barra superior y en el panel móvil, siguiendo el mismo patrón que el link "Inicio" (SPEC 02). Sistema funcional: la navegación completa del sitio queda enlazada — Inicio, Biblioteca, Salón de la Fama, Acerca de, Login.
7. **Pulido final.** Revisar responsive de las nuevas secciones y que `npm run build` y `npm run lint` pasen sin errores. Probar manualmente el flujo de envío (éxito y, simulando una `RESEND_API_KEY` inválida, el estado de error).

## Criterios de aceptación

- [ ] `npm run build` compila sin errores.
- [ ] `npm run lint` pasa sin errores.
- [ ] La ruta `/about` muestra el hero, los 3 highlights, el divider animado y la sección de contacto con formulario.
- [ ] Las secciones con clase `.reveal` aparecen animadas al hacer scroll hasta ellas.
- [ ] Enviar el formulario con campos vacíos dispara el efecto `shake` y no hace ningún `fetch`.
- [ ] Enviar el formulario con datos válidos hace `POST` a `/api/contact`, y si Resend responde con éxito, se muestra la pantalla `terminal-success` con el nombre ingresado.
- [ ] Si `/api/contact` responde con error (ej. `RESEND_API_KEY` ausente o inválida), el formulario muestra un mensaje de error visible y conserva los datos escritos para reintentar, sin pasar a `terminal-success`.
- [ ] El correo real llega a `ccomayagua@redserfinsa.com` cuando `RESEND_API_KEY` está correctamente configurada en `.env.local`.
- [ ] El Nav muestra el link "Acerca de" apuntando a `/about`, resaltado solo en esa ruta, tanto en la barra superior como en el panel móvil.
- [ ] `RESEND_API_KEY` no aparece hardcodeada en ningún archivo versionado (solo referenciada vía `process.env`).

## Decisiones tomadas y descartadas

- **Route Handler (`app/api/contact/route.ts`)** en vez de Server Action, para mantener el envío de correo explícitamente aislado en un endpoint propio y facilitar pruebas manuales (curl/Postman) independientes del formulario.
- **Destinatario fijo `ccomayagua@redserfinsa.com`** hardcodeado en el servidor, en vez de configurable, porque no hay múltiples administradores del proyecto ni necesidad de variar el destino.
- **Remitente `onboarding@resend.dev`** (dominio de pruebas de Resend) en vez de un dominio propio verificado, porque el proyecto no tiene un dominio configurado en Resend todavía; migrar el remitente a un dominio propio queda fuera de este spec.
- **Se agrega estado de error visible en el formulario** (en vez de solo loguear el fallo), porque el template original solo contemplaba el camino feliz y dejar al usuario sin feedback ante un fallo de red o de la API sería una regresión de UX.
- **Sin persistencia de mensajes** ni cola de reintentos: el mensaje vive solo como correo enviado; si Resend falla, el único camino es que el usuario reintente manualmente.
- **Se agrega el link "Acerca de" al Nav ahora**, revirtiendo la decisión de SPEC 02 de omitirlo, porque ahora sí existe diseño y contenido de referencia completos para esa pantalla.

## Riesgos identificados

- Si `RESEND_API_KEY` no está definida en `.env.local` durante desarrollo o en las variables de entorno de producción, todo envío fallará con el nuevo estado de error; esto es esperado pero debe documentarse claramente para que no se confunda con un bug.
- El endpoint `/api/contact` no tiene rate limiting ni protección anti-spam; en un entorno público podría ser abusado para enviar correos arbitrarios a través de la cuenta de Resend del proyecto. Aceptado como riesgo conocido para este MVP.
