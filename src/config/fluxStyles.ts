export interface FluxStyle {
  avatar: string;
  hot: boolean;
  id: number;
  newFeature: boolean;
  style: string;
  style_cls: string;
}

export interface FluxStyles {
  [key: string]: FluxStyle[];
}

export const FLUX_STYLES: FluxStyles = {
  "Photograph": [
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F0.webp", "hot": false, "id": 1, "newFeature": false, "style": "No Style", "style_cls": "Photograph" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F1.webp", "hot": false, "id": 2, "newFeature": false, "style": "Bokeh", "style_cls": "Photograph" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F2.webp", "hot": false, "id": 3, "newFeature": false, "style": "Food", "style_cls": "Photograph" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F3.webp", "hot": false, "id": 4, "newFeature": false, "style": "iPhone", "style_cls": "Photograph" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F4.webp", "hot": false, "id": 5, "newFeature": false, "style": "Film Noir", "style_cls": "Photograph" }
  ],
  "Art": [
    { "avatar": "https://pub-static.aiease.ai/aiease-sys/common/e6fdfa65719544d1bac831820c5d3b7b.webp", "hot": false, "id": 70, "newFeature": true, "style": "ToothiePop", "style_cls": "Art" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2Fart_v1-Ghibli.webp", "hot": false, "id": 68, "newFeature": false, "style": "Ghibli", "style_cls": "Art" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F5.webp", "hot": false, "id": 6, "newFeature": false, "style": "Cubist", "style_cls": "Art" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F6.webp", "hot": false, "id": 7, "newFeature": false, "style": "Pixel", "style_cls": "Art" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F7.webp", "hot": false, "id": 8, "newFeature": false, "style": "Dark Fantasy", "style_cls": "Art" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F8.webp", "hot": false, "id": 9, "newFeature": false, "style": "Van Gogh", "style_cls": "Art" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F9.webp", "hot": false, "id": 10, "newFeature": false, "style": "Caricature", "style_cls": "Art" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F10.webp", "hot": false, "id": 11, "newFeature": false, "style": "Statue", "style_cls": "Art" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F11.webp", "hot": false, "id": 12, "newFeature": false, "style": "Watercolor", "style_cls": "Art" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F12.webp", "hot": false, "id": 13, "newFeature": false, "style": "Oil Painting", "style_cls": "Art" }
  ],
  "Cartoon": [
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F13.webp", "hot": false, "id": 14, "newFeature": false, "style": "Manga", "style_cls": "Cartoon" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F14.webp", "hot": false, "id": 15, "newFeature": false, "style": "Sketch", "style_cls": "Cartoon" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F15.webp", "hot": false, "id": 16, "newFeature": false, "style": "Comic", "style_cls": "Cartoon" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F16.webp", "hot": false, "id": 17, "newFeature": false, "style": "Kawaii", "style_cls": "Cartoon" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F17.webp", "hot": false, "id": 18, "newFeature": false, "style": "Chibi", "style_cls": "Cartoon" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F18.webp", "hot": false, "id": 19, "newFeature": false, "style": "Disney", "style_cls": "Cartoon" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F19.webp", "hot": false, "id": 20, "newFeature": false, "style": "Pixar", "style_cls": "Cartoon" },
    { "avatar": "https://pub-static.aiease.ai/aieaseExample%2FartV1%2Fstyle%2F20.webp", "hot": false, "id": 21, "newFeature": false, "style": "Funko Pop", "style_cls": "Cartoon" }
  ]
};

export const DEFAULT_FLUX_STYLE = 1; // Default to "No Style"
