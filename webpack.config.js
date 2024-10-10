const path = require('path');
const webpack = require('webpack');

const isProduction = false;

module.exports = {
  mode: 'development',
  context: path.resolve(__dirname, 'src'),
  entry: {
    main: './main.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
      }, {
        test: /\.(vert|frag|comp|wgsl)$/,
        use: 'raw-loader',
      }, {
        test: /\.css/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              url: false,
              sourceMap: true,
              importLoaders: 2
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [
      '.ts', '.js',
    ],
  },
  devtool: 'inline-source-map',
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      PRODUCTION_BUILD: JSON.stringify(isProduction),
    })
  ],
};
