// Invented, sanitized fixtures shaped like the real Graph API responses. No real data or tokens.
export const NOW = new Date("2026-11-10T12:00:00Z");

export const profile = {
  id: "17841000000000001",
  username: "example_account",
  followers_count: 14200,
  media_count: 5,
};

export const media = {
  data: [
    {
      id: "m1",
      caption: "  First reel caption  ",
      media_type: "VIDEO",
      media_product_type: "REELS",
      thumbnail_url: "https://scontent-x.cdninstagram.com/v/t51/thumb1.jpg?sig=abc",
      media_url: "https://video.cdninstagram.com/v/1.mp4",
      permalink: "https://www.instagram.com/reel/AAA111/",
      timestamp: "2026-10-20T10:00:00+0000",
      like_count: 1,
      comments_count: 1,
    },
    {
      // no media_url, no caption, non-Instagram thumbnail host
      id: "m2",
      media_type: "VIDEO",
      media_product_type: "REELS",
      thumbnail_url: "https://evil.example.com/thumb2.jpg",
      permalink: "https://www.instagram.com/reel/BBB222/",
      timestamp: "2026-09-12T08:30:00+0000",
      like_count: 1,
      comments_count: 1,
    },
    {
      id: "m3",
      caption: "Third reel",
      media_type: "VIDEO",
      media_product_type: "REELS",
      thumbnail_url: "https://scontent.xx.fbcdn.net/v/thumb3.jpg",
      media_url: "https://video.fbcdn.net/v/3.mp4",
      permalink: "https://www.instagram.com/reel/CCC333/",
      timestamp: "2026-10-01T00:00:00+0000",
      like_count: 1,
      comments_count: 1,
    },
    {
      id: "m4",
      caption: "   ",
      media_type: "VIDEO",
      media_product_type: "REELS",
      thumbnail_url: "http://scontent.cdninstagram.com/insecure.jpg",
      media_url: "https://video.cdninstagram.com/v/4.mp4",
      permalink: "https://www.instagram.com/reel/DDD444/",
      timestamp: "2026-10-05T00:00:00+0000",
      like_count: 1,
      comments_count: 1,
    },
    {
      id: "p1",
      caption: "A feed photo",
      media_type: "IMAGE",
      media_product_type: "FEED",
      media_url: "https://scontent.cdninstagram.com/v/photo.jpg",
      permalink: "https://www.instagram.com/p/EEE555/",
      timestamp: "2026-09-07T00:00:00+0000",
      like_count: 1,
      comments_count: 1,
    },
  ],
};

const ri = (views: number, likes: number, comments: number, shares: number, saved: number) => ({
  data: [
    { name: "views", period: "lifetime", values: [{ value: views }] },
    { name: "likes", period: "lifetime", values: [{ value: likes }] },
    { name: "comments", period: "lifetime", values: [{ value: comments }] },
    { name: "shares", period: "lifetime", values: [{ value: shares }] },
    { name: "saved", period: "lifetime", values: [{ value: saved }] },
  ],
});

export const reelInsights: Record<string, unknown> = {
  m1: ri(5000, 400, 20, 100, 50),
  m2: ri(9000, 800, 30, 200, 90),
  m3: ri(7000, 600, 25, 150, 70),
  m4: ri(100, 10, 1, 2, 3),
};

const chunk = (v: number, ti: number, l: number, s: number, sv: number) => ({
  data: [
    { name: "views", period: "day", total_value: { value: v } },
    { name: "total_interactions", period: "day", total_value: { value: ti } },
    { name: "likes", period: "day", total_value: { value: l } },
    { name: "shares", period: "day", total_value: { value: s } },
    { name: "saves", period: "day", total_value: { value: sv } },
  ],
});

/** Index 0 = most recent 30 days. */
export const accountChunks = [
  chunk(10000, 1500, 1000, 300, 200),
  chunk(20000, 3000, 2000, 600, 400),
  chunk(30000, 4500, 3000, 900, 600),
];
