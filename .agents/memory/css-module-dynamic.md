---
name: CSS modules dynamic class injection
description: CSS module class names cannot be used inside injected <style> tags
---

CSS modules transform class names (e.g. `cardHighlight` → `_cardHighlight_abc123`). Injecting a `<style>` tag that references `styles.cardHighlight` produces `.undefined { ... }` if the class isn't defined in the module, or a valid selector but only if the class exists and the transformed name matches.

**Why:** The `<style>` tag approach is fragile and defeats CSS module encapsulation.

**How to apply:** Always define conditional highlight/state classes in the `.module.css` file and apply them via `className={styles.myClass}` directly on the element. Use conditional ternary: `className={`${styles.card} ${needsHighlight ? styles.cardHighlight : ''}`}`.
