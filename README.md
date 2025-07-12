# Timelapse of COVID-19 data in the Netherlands

## Demo Link

Access my site at [covid-data-nl.netlify.app](https://covid-data-nl.netlify.app/).

## Table of Contents

- [About The App](#about-the-app)
- [Screenshots](#screenshots)
- [Setup](#setup)
- [Development](#development)
- [Approach](#approach)
- [Status](#status)
- [License](#license)

## About The App

This app visualizes COVID-19 data in the Netherlands, as published by the National Institute for Public Health and the Environment (Rijksinstituut voor Volksgezondheid en Milieu) or [RIVM](https://www.rivm.nl/).

Built with modern web technologies:

- **React 19** with TypeScript
- **Vite** for fast development and building
- **D3.js** for data visualization
- **Material-UI** for responsive design
- **Netlify** for deployment

## Screenshots

![alt text](/Screenshot_1.png "Screenshot 1")
![alt text](/Screenshot_2.png "Screenshot 2")

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Timelapse-COVID-19-Data

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

## Development

This project uses:

- **TypeScript** for type safety
- **ESLint** for code quality
- **Vite** for fast development and optimized builds
- **Material-UI** for responsive components

## Approach

- Uses data published by RIVM
- Performs basic data cleaning operations
- Uses population data per municipality to compute case rates
- Implements 14-day moving average for smooth animations
- Responsive design for mobile and desktop

## Status

This app is actively developed. Planned improvements for version 2.0:

- [ ] Enhanced map interactions (zoom, pan)
- [ ] Support for additional metrics (hospitalization, mortality)
- [ ] Improved performance optimizations
- [ ] Better accessibility features

## License

MIT License.
