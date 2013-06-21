var loadTables = function(){
  scraperwiki.sql.meta(function(meta){
    if(meta.table.length == 0){
      scraperwiki.alert('This dataset is empty', 'Try running this tool again once you&rsquo;ve got some data.')
      return false
    }
    console.log(meta.table)
  }, function(){
    scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql.meta() failed', 1)
  })
}

google.load('visualization', '1.0', {'packages':['corechart']})
google.setOnLoadCallback(function(){
  console.log('Google Charts API has loaded')
})

$(function(){
  loadTables()
})
