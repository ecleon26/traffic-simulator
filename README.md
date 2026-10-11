# Traffic Intersection Simulation — Web Edition


## Run locally
```
npx serve .
# or just open index.html in a browser
```

## Deploy
- **Netlify**: drag & drop this folder at [app.netlify.com](https://app.netlify.com/drop)
- **Vercel**: `npx vercel --prod` from this directory
- **GitHub Pages**: push to a repo, enable Pages from root

## Features
- Real-time canvas-based intersection rendering
- 4-direction vehicle spawning (N→S, S→N, W→E, E→W)
- Traffic light state machine (Green → Left-Green → Yellow → Red → Yellow)
- Sightseeing (safe following) + Go-Through modes
- Live stats: vehicle count, moving/queued, throughput, congestion
- Real-time Chart.js graphs
- Runtime-adjustable signal timings and spawn rates
- Responsive layout with dark theme
