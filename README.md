# Quick Setup: Custom Integration in Missive

Before you begin, you need to add the integration to your Missive account.

1.  Open Missive and go to **Settings**.
2.  Click on the **Integrations** section and **Add integration**
3.  Find **Custom** and click on **Add to Missive**
4.  Fill in the **Name** field, for example: `Stripe`.
5.  For the **iFrame URL**, use: `https://extendkit.com/integrations/for-missive/stripe-sidebar/` or you can host your integration app (folder `iframe` in this repository)
6.  Optionally, you can add an icon for the integration later (we suggest use `stripe.png` from `/icon/` folder)

After setting this up, you can proceed with one of the backend options:
- [Custom Stripe Proxy Backend](#custom-stripe-proxy-backend)
- [Hosted Backend](#hosted-backend)

# Custom Stripe Proxy Backend

This document explains how to set up your own backend proxy to connect your Stripe account to the Missive integration. This is an alternative to using our hosted backend.

## Why a Proxy is Needed

For security reasons, your Stripe API secret key should never be exposed in a client-side application like a browser extension. The proxy acts as a secure intermediary. The Missive iframe calls your proxy with a secure token/key, and your proxy then makes authenticated requests to the Stripe API using your Stripe secret key, forwarding the results back to the iframe.

## How it Works

1.  The Missive iframe sends a request to your proxy URL (e.g., `https://your-domain.com/path-to-script/stripe/v1/customers/search?...`).
2.  The request from the iframe includes a secret header you have configured (e.g., `X-API-KEY: your-secret-value`).
3.  Your proxy script validates this header.
4.  If valid, the proxy forwards the request to the official Stripe API endpoint (`https://api.stripe.com`). It will strip `/stripe` from the path. For example, a request to `/stripe/v1/customers/search` on your proxy becomes a request to `/v1/customers/search` on the Stripe API.
5.  The proxy adds your Stripe API secret key to the `Authorization` header of the request to Stripe.
6.  The response from Stripe is passed back to the Missive iframe.

## Implementation Examples

For simple Node.js implementation you can check our open source repo: https://github.com/conceptovo/extendkit-missive-stripe-proxy

# Hosted Backend

If you prefer not to manage your own server, you can use our secure, hosted backend.

## Price

Price for this hosted version is only **4 USD / month**. You can use our trial for free: https://dashboard.extendkit.com

## Is it worth it?

Every hosted service costs money. In principle, we believe that services can be dangerous because, if they do not generate income, they cannot dedicate resources to security and maintenance.

## Why is the Hosted Backend Safe?

We've engineered the hosted backend with security as a top priority. Here’s why you can trust it with a restricted Stripe API key:

*   **Built on Cloudflare Workers:** Our backend runs on [Cloudflare's serverless platform](https://workers.cloudflare.com/), which provides a secure, isolated environment for execution.

*   **Encrypted API Key Storage:** Your API key is stored using Cloudflare Secrets, which handles the encryption. The key is stored in an encrypted format and is only decrypted in memory when processing a request. This ensures the key remains hidden from both: us and Cloudflare.

*   **Restricted API Key Support:** Our backend is designed to work only with **restricted** Stripe API keys. Never give anyone a secret key with full access.

## Creating a Restricted Stripe API Key

A restricted key limits access to only what's necessary for the integration to function. This ensures that even in the unlikely event of a compromise, no sensitive data can be modified.

Follow these steps to create a key with the correct read-only permissions:

1.  Navigate to the **[API Keys](https://dashboard.stripe.com/apikeys)** section in your Stripe Dashboard.
2.  Click **+ Create restricted key**. [Learn more about restricted keys](https://stripe.com/docs/keys#limit-access)
3.  Select **A third-party application**.
4.  Give the key a descriptive name, for example, `Missive Integration`.
5.  Grant **Only Read access** to the following permissions. Set all others to **None**.
    *   **Customers**: Found under `Core Permissions`. This allows fetching customer details.
    *   **Invoices**: Found under `Billing Permissions`. This allows reading payment history.
    *   **Products**: Found under `Billing Permissions`. This allows fetching details about products associated with subscriptions.
    *   **Subscriptions**: Found under `Billing Permissions`. This allows viewing subscription statuses.
6.  Click **Create key** at the bottom of the page.
7.  Your restricted key will be revealed. Copy this key and use it as the `API Key` when setting up the hosted backend in Missive. Restricted key starts with "rk_live_..."

By using a key with these minimal, read-only permissions, you ensure the integration can access the data it needs to display without exposing your account to any risk of data modification. The key is securely stored and only used on the server-side to communicate with Stripe. 