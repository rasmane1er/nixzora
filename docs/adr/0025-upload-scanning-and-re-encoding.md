# ADR-0025: Uploaded images are scanned and re-encoded before they are served

- Status: Accepted
- Date: 2026-10-04
- Roadmap: p9-07 (upload image re-encoding and malware scanning)
- Builds on: ADR-0005 (media storage), ADR-0018 (seller onboarding)

## Context

Staff, sellers and customers upload images: product photos, store logos and banners, profile
photos. Until now the API checked the declared type and the first bytes of the file, then
served the file exactly as uploaded from the media domain. That left three gaps:

- **Metadata.** Phone photos carry EXIF: GPS location, device serial numbers, the owner's name.
  A seller photographing stock at home could publish their address.
- **Hidden content.** A file can be a valid image and something else at once (a "polyglot":
  image data followed by a script or an archive). It passes the signature check and is served
  from our domain.
- **Malware.** Nothing looked inside uploads at all.

Sellers are third parties, so their uploads are untrusted input.

## Decision

**Uploads land in `incoming/`; only re-encoded copies reach `products/`, the one prefix served.**

1. The upload ticket still names the final key (`products/2027/03/<id>.jpg`), so clients do not
   change, but the presigned PUT (or the local upload link) writes to `incoming/2027/03/<id>.jpg`.
2. Every place that accepts an uploaded image calls `MediaIntakeService.ensureReady(key)`. It:
   - waits for the **malware scan** when `MEDIA_MALWARE_SCAN=guardduty`. GuardDuty Malware
     Protection for S3 scans each new object in `incoming/` and tags it. `THREATS_FOUND` is
     deleted, audited and refused (422). Scans that could not run are refused too (503), and the
     user is asked to try again if no verdict arrives within `MEDIA_SCAN_WAIT_SECONDS`;
   - **decodes and re-encodes** the image with sharp: turned upright from its EXIF orientation,
     longest side at most 2,400 px, same format, **no metadata**. Only pixels survive, so
     appended payloads disappear. A file that does not decode is refused (400) and deleted;
   - writes the result to `products/` and deletes the original.
3. A form that previews before saving (store branding) calls `POST /media/ready`, which does the
   same.
4. The bucket deletes anything left in `incoming/` after a day, and CloudFront may read only
   `products/*`.

Processing happens inline, when the image is attached, not in a background job: a photo is
under 5 MB and re-encoding takes tens of milliseconds, and the person attaching it gets the
answer (accepted, unreadable, unsafe) right away instead of a photo that silently never appears.

## Consequences

- Served images are smaller and uniform, and leak no location or device data.
- GuardDuty bills per GB scanned (small at our volumes). It is on by default in Terraform
  (`media_malware_scan`); local development has no scanner and relies on re-encoding.
- Re-encoding loses an image's embedded colour profile beyond sRGB conversion. Acceptable for
  product photos.
- Images uploaded before this change stay as they were. Re-uploading or a one-off re-encode job
  can clean them; the demo catalog ships its own illustrations.
- The upload ticket's `publicUrl` works only after `ensureReady`. Clients that show a preview
  before saving must call `/media/ready` first.
