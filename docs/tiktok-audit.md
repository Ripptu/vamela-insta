# TikTok Direct-Post-Audit (Content Posting API)

Stand 25.10.2026. App „VAMELA Insta“ (ID 7696093696357517333) ist seit 20.10.2026 live. Öffentliches Direkt-Posten braucht zusätzlich diesen Audit: developers.tiktok.com → App → Products → Content Posting API → Direct Post → **Apply**.

## Schritt 1: General Information

- **Full Name:** Christian Stockmeier
- **Organization name:** VAMELA
- **Organization website:** https://vamela.de
- **Describe your organization's work as it relates to TikTok:**
  VAMELA is a small web and graphic design studio in Haag an der Amper, Bavaria, Germany. We publish short educational photo carousels for local small businesses (tips on websites, Google profiles and design) on our own TikTok account @vamela.de. "VAMELA Insta" is our internal tool: it prepares these posts and publishes them to our own account at scheduled times after the account owner has reviewed and approved them.
- **TikTok representative email:** leer lassen

## Schritt 2: API client information

- **Use case:** Internal scheduling tool for a single creator account (our own business account). No third-party users.
- **Number of users:** 1 (the account owner)
- **Expected posts per day:** up to 4 photo posts
- **Content type:** Photo posts (carousels, 6 images, 1080 × 1920 JPEG), pulled from our verified URL prefix https://media.vamela.de/
- **How the UX follows the Content Sharing Guidelines:**
  Before anything is published, the owner opens the "TikTok → Freigabe" screen in our desktop app. It shows the creator nickname and avatar from creator_info, a preview of every post with an editable title, a privacy selector without default (options from privacy_level_options), the "Allow comment" setting (off by default, disabled if the creator turned comments off), the commercial content disclosure toggle with "Your brand" / "Branded content" and the matching label notice, and the Music Usage Confirmation (plus Branded Content Policy when branded content is selected). Only posts the owner explicitly approves are published with exactly these settings; all others are sent to the TikTok inbox as drafts. AI-generated images are labelled with is_aigc. After publishing, the app shows the post status and a processing notice.

## Schritt 3: Supporting documents

- **Demo-Video** (2–5 Min., MP4, < 50 MB), Ablauf:
  1. App „VAMELA Insta“ öffnen → Einstellungen → Einrichtung → TikTok → „Mit TikTok anmelden“ → TikTok-Login und Autorisieren → Code auf vamela.de/tiktok-verbinden/ → in der App einfügen → „TikTok ist verbunden“.
  2. Bereich **TikTok → Freigabe**: Kontoname zeigen, Sichtbarkeit wählen, Kommentare, Offenlegung „Deine Marke“ an, Hinweis zur Music Usage Confirmation, einen Beitrag auswählen, Titel zeigen, „Ausgewählte freigeben“.
  3. Den veröffentlichten Beitrag in der TikTok-App bzw. auf tiktok.com zeigen (vor dem Audit nur privat sichtbar).
- **Screenshots:** Freigabe-Ansicht (oben und unten), veröffentlichter Beitrag.

## Danach

Nach bestandenem Audit in `plan/params.json`: `tiktok.modus` = `direkt`. Die Sichtbarkeit kommt dann je Beitrag aus der Freigabe.
