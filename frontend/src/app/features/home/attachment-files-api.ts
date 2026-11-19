import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { Attachment } from './attachment';

/** The only place that downloads saved files from the backend. */
@Injectable({
  providedIn: 'root',
})
export class AttachmentFilesApi {
  private readonly http = inject(HttpClient);

  /**
   * Download a saved file and return a temporary browser link to it.
   * Needed because the file link is protected: an `<img src>` cannot send the login token,
   * but this request can (the auth interceptor adds it). Free the link with `URL.revokeObjectURL`.
   */
  loadFileUrl(fileUrl: string): Observable<string> {
    return this.http
      .get(fileUrl, { responseType: 'blob' })
      .pipe(map((file) => URL.createObjectURL(file)));
  }

  /** Save a file to the user's computer. */
  saveFile(attachment: Attachment): void {
    this.loadFileUrl(attachment.file_url).subscribe((url) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  /** Show a file in a new browser tab. */
  openInNewTab(attachment: Attachment): void {
    // The tab is opened first, while the click still counts: browsers block tabs opened later.
    const tab = window.open('', '_blank');
    this.loadFileUrl(attachment.file_url).subscribe({
      next: (url) => tab?.location.replace(url),
      error: () => tab?.close(),
    });
  }
}
