# Setting up Convex + Google sign-in

About 15 minutes, one time. Everything happens in three web dashboards. You don't need anything installed locally.
Dashboard labels change now and then; if a name differs slightly, look for the closest match.

You'll collect three things along the way:

| What | Looks like | Where it goes |
|---|---|---|
| Convex **HTTP Actions URL** | `https://<name>.convex.site` | Google OAuth redirect URI |
| Convex **production deploy key** | `prod:<name>|eyJ…` (secret) | GitHub secret `CONVEX_DEPLOY_KEY` |
| Google **client ID + secret** | `…apps.googleusercontent.com` + `GOCSPX-…` (secret) | Convex environment variables |

## 1. Create the Convex project
1. Go to https://dashboard.convex.dev and sign up (**Continue with GitHub** is easiest).
2. Create a project and name it `bela`.
3. Open the project's **Production** deployment (deployment picker at the top), then **Settings**.
4. Copy the **HTTP Actions URL** (ends in `.convex.site`). You need it in step 3.
5. On the same page, click **Generate Production Deploy Key** and copy it. It's shown only once.

## 2. Give GitHub the deploy key
1. Go to https://github.com/nikolalukic167/bela/settings/secrets/actions and click **New repository secret**.
2. Name it `CONVEX_DEPLOY_KEY` and paste the deploy key as the value.

## 3. Create the Google sign-in client
1. Go to https://console.cloud.google.com, create a project (for example `bela`), and select it.
2. Open **APIs & Services → OAuth consent screen** (also called **Google Auth Platform**). Then:
   - App name `Bela`, your email as the support and contact email
   - Audience: **External**
   - Under **Audience**, either click **Publish app**, or add your own Google account (and any friends) as **test users**. While the app is in "Testing", only test users can sign in.
     For the basic scopes we use (name, email, picture), publishing does not need Google's review.
3. Open **Credentials** (or **Clients**), then **Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `Bela`
   - **Authorized redirect URIs → Add URI**: `https://<name>.convex.site/api/auth/callback/google`
     (your HTTP Actions URL from step 1, plus `/api/auth/callback/google`)
4. Click **Create** and copy the **Client ID** and **Client secret**.

## 4. Put the Google credentials into Convex
In the Convex dashboard, open **Production → Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `AUTH_GOOGLE_ID` | the Client ID |
| `AUTH_GOOGLE_SECRET` | the Client secret |

## 5. Run the one-click auth setup
1. Go to https://github.com/nikolalukic167/bela/actions/workflows/convex-auth-setup.yml.
2. Click **Run workflow**, keep the defaults, and click **Run workflow**.
3. This generates the sign-in signing keys (`JWT_PRIVATE_KEY`, `JWKS`) and sets `SITE_URL` on your Convex deployment.
   Values go to Convex through a private temp file and are masked, so they don't appear in the log, even when a step fails.

## 6. Deploy
1. Go to https://github.com/nikolalukic167/bela/actions/workflows/deploy.yml.
2. Click **Run workflow** (branch `main`). Any later push to `main` also does this.
3. With the deploy key present, the workflow deploys the Convex functions and builds the site connected to them.

## 7. Try it
1. Open https://nikolalukic167.github.io/bela/ and refresh.
2. Open the ☰ menu and choose **Račun → Prijava s Googleom**.
3. After Google, you land back on the same page, and the menu shows your name and picture.

## Troubleshooting
- **"Not authorized" / "CONVEX_DEPLOY_KEY is a "preview" key":** the secret must be a **production** deploy key (it starts with `prod:`).
  Switch the Convex dashboard to the **Production** deployment before generating it, then replace the GitHub secret and re-run.
- **Google says `redirect_uri_mismatch`:** the redirect URI in step 3 must be exactly `https://<name>.convex.site/api/auth/callback/google`. Use `.site`, not `.cloud`.
- **Google says "access blocked" or the app isn't verified:** publish the app or add yourself as a test user (step 3.2).
- **You come back signed out:** check that `SITE_URL` is `https://nikolalukic167.github.io/bela` (no trailing slash) under Convex **Environment Variables**, and that `JWT_PRIVATE_KEY` and `JWKS` exist. If not, re-run step 5.
- **The menu still says "Prijava · Uskoro":** the site was built without Convex. Re-run step 6 and check that the deploy log shows `convex deploy`.
