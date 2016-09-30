function CompilationAsset(content)
{
  if ( content === undefined ) {
    throw new Error('content is required');
  }

  this.content = content.toString();
}

CompilationAsset.prototype.source = function()
{
  return this.content;
};

CompilationAsset.prototype.size = function()
{
  return this.content.length;
};

module.exports = CompilationAsset;
