import type { DownloaderAPI } from '../../shared/contracts'
declare global { interface Window { downloader: DownloaderAPI } }
