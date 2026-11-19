import type { MetadataRoute } from "next";

/** Lets staff add the app to their phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Event bookings",
    short_name: "Bookings",
    description: "Party and event bookings, menus, and contracts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6f1",
    theme_color: "#2c5e3f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
