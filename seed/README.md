# Seed incidents

Drop real historical incidents from your own projects here as JSON, one
per file, then write a small `seed/load.ts` script (not included yet —
build this once you've pulled 4-6 real incidents from nillohit /
reddit-link-health-checker / leadhunt) that calls `recordIncident()`
for each one before the demo.

Example shape:

```json
{
  "title": "Reddit API rate limit silently dropping link checks",
  "symptoms": "Health checker reported all links as healthy overnight, but manual spot-check showed several were dead. No errors in logs.",
  "rootCause": "Reddit API started returning 429s; the retry wrapper swallowed the error and treated timeout as success.",
  "resolution": "Added explicit status code check before marking a link healthy, alert on repeated 429s.",
  "severity": "high",
  "sourceProject": "reddit-link-health-checker"
}
```
