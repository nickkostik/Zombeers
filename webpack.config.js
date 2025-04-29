const path = require('path');

module.exports = {
  // Set mode based on NODE_ENV, default to 'development'
  mode: process.env.NODE_ENV || 'development',
  // Entry point of the application
  entry: './public/js/main.js',
  // Output configuration
  output: {
    // Output directory (absolute path)
    path: path.resolve(__dirname, 'public', 'dist'),
    // Output filename
    filename: 'bundle.js',
  },
  // Optional: Add source maps for easier debugging
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
  // Optional: Configure how modules are resolved (though defaults are often fine)
  resolve: {
    extensions: ['.js'], // Automatically resolve .js extensions
  },
  // Optional: Add rules for loaders if needed (e.g., for CSS, Babel)
  // module: {
  //   rules: [
  //     // Example: Babel loader for older browser compatibility
  //     // {
  //     //   test: /\.js$/,
  //     //   exclude: /node_modules/,
  //     //   use: {
  //     //     loader: 'babel-loader',
  //     //     options: {
  //     //       presets: ['@babel/preset-env']
  //     //     }
  //     //   }
  //     // }
  //   ]
  // }
};