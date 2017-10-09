# Enonic XP web socket utility library #

## Documentation ##

Go [here](https://itemconsulting.github.io/wsutil-server/) for documentation

## Version ##

### 0.0.1 ###
 * Initital release

Compatibility Enonic XP 6.4.0

## Dependencies ##

```
# build.gradle

dependencies {
    include "com.enonic.xp:lib-portal:${xpVersion}"
    include "com.enonic.xp:lib-io:${xpVersion}"
    include "com.enonic.xp:lib-websocket:${xpVersion}"
    include "no.item.wsUtil:wsUtil:0.0.1"
}

repositories {
    mavenLocal()
    jcenter()
    maven {
        url 'http://repo.enonic.com/public'
    }
   maven {
        url  "https://dl.bintray.com/pdrevland/wsUtil"
   }
}
```

## License ##

This project is under the GPL v3. For more information please read [LICENSE.txt](LICENSE.txt)


