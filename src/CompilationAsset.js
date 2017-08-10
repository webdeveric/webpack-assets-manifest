'use strict';

class CompilationAsset
{
  constructor(content)
  {
    if ( content === undefined ) {
      throw new Error('content is required');
    }

    this.content = content.toString();
  }

  source()
  {
    return this.content;
  }

  size()
  {
    return this.content.length;
  }
}

module.exports = CompilationAsset;
