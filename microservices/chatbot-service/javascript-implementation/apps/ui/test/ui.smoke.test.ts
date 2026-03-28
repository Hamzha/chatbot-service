import { describe, expect, it } from "vitest";
import { renderApp } from "../src/main.js";

describe("ui smoke", () => {
  it("renders upload route by default", () => {
    document.body.innerHTML = '<div id="app"></div>';
    history.pushState({}, "", "/");
    const root = document.getElementById("app") as HTMLElement;

    renderApp(root);

    expect(document.getElementById("file-input")).toBeTruthy();
    expect(document.getElementById("upload-btn")).toBeTruthy();
    expect(document.getElementById("drop-zone")).toBeTruthy();
  });

  it("navigates to chat route from navbar", () => {
    document.body.innerHTML = '<div id="app"></div>';
    history.pushState({}, "", "/chat");
    const root = document.getElementById("app") as HTMLElement;

    renderApp(root);

    expect(window.location.pathname).toBe("/chat");
    expect(document.getElementById("question")).toBeTruthy();
    expect(document.getElementById("send-btn")).toBeTruthy();
    expect(document.getElementById("clear-btn")).toBeTruthy();
    expect(document.getElementById("messages")).toBeTruthy();
  });
});
