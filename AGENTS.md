<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pushing goes to both repositories

This project is mirrored. `origin` fetches from Clynton19860 and pushes to both:

    Clynton19860/herdwise   the working repository, and what Vercel deploys
    ogjr80/herdwise         ITTHYNK's copy, reviewed by the manager

A single `git push origin main` reaches both. Never push to one alone — the two
drifting apart is how a reviewer ends up reading code that is not what is
deployed.

The configuration lives in `.git/config`, so it does not survive a fresh clone.
After cloning, restore it with:

    git remote set-url --add --push origin https://github.com/Clynton19860/herdwise.git
    git remote set-url --add --push origin https://github.com/ogjr80/herdwise.git

Verify with `git remote -v`: `origin` should list one fetch URL and two push URLs.
