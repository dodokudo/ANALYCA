export type ScheduledPostMediaItem = {
  url: string;
  type: 'IMAGE' | 'VIDEO';
  altText?: string;
  name?: string;
};

export type ScheduledPost = {
  scheduleId: string;
  scheduledAt: string;
  scheduledAtJst: string;
  scheduledDate: string;
  status: string;
  mainText: string;
  mediaItems: ScheduledPostMediaItem[];
  comment1MediaItems: ScheduledPostMediaItem[];
  comment2MediaItems: ScheduledPostMediaItem[];
  comment1: string;
  comment2: string;
  comment3: string;
  comment4: string;
  comment5: string;
  comment6: string;
  comment7: string;
  createdAt: string;
  updatedAt: string;
};

export type SchedulePreviewData = {
  scheduledAt: string;
  mainText: string;
  comment1: string;
  comment2: string;
  comment3: string;
  comment4: string;
  comment5: string;
  comment6: string;
  comment7: string;
  mediaItems: ScheduledPostMediaItem[];
  comment1MediaItems: ScheduledPostMediaItem[];
  comment2MediaItems: ScheduledPostMediaItem[];
};
