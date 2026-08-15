// Mobile nav toggle, a header scroll shadow, and a scroll-reveal effect.
// The FAQ accordion uses native <details>/<summary> and needs no JS.
// No analytics, no third-party requests.

(function () {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
})();

(function () {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const setScrolled = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  setScrolled();
  window.addEventListener("scroll", setScrolled, { passive: true });
})();

(function () {
  const targets = document.querySelectorAll("[data-reveal]");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
  );

  targets.forEach((el) => observer.observe(el));
})();
