import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  // 1. Change the main landing path to go STRAIGHT to your functional login page!
  index("loginAuth/login.tsx"),

  // 2. Wrap your workspace pages normally
  route("home", "routes/home.tsx", [
    index("routes/dashboard.tsx"),
    route("timetable", "routes/timetable.tsx"),
    route("chatbot", "routes/chatbot.tsx"),
    route("flashcard", "routes/flashcard.tsx"),
    route("collaboration", "routes/collaboration.tsx"),
  ]),
] satisfies RouteConfig;