import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/cases/", "/admin", "/account"],
      },
    ],
    sitemap: "https://veracase.app/sitemap.xml",
  };
}
